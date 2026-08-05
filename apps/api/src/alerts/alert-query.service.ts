/**
 * apps/api/src/alerts/alert-query.service.ts
 *
 * Alert state query service — READ-ONLY access to the `alerts` table for
 * the compliance/review API.
 *
 * The notifications microservice owns alert WRITES (creation, escalation);
 * this service only ever SELECTs, exposing the acknowledgment + escalation
 * lifecycle state that auditors and reviewers need:
 *
 *   - full alert history per patient (acknowledged? by whom? when? escalated?)
 *   - filtered searches across all patients (severity, ack state, date range)
 *   - aggregate compliance summaries (ack rates, escalation rates)
 *
 * The escalation timestamp lives in the alert's JSONB `metadata.escalatedAt`
 * (written by the escalation sweeper), and is lifted to a first-class field
 * in the response.
 *
 * Like AuditService, the Drizzle client is created directly in the
 * constructor (no DI) — matching the repo's convention for read-only
 * gateway query services.
 */
import { Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { createDb, schema, type Database } from '@caregiver/db';
import type {
  AlertSeverity,
  AlertStateQuery,
  AlertStateResponse,
  AlertStateSummary,
} from '@caregiver/contracts';

/** Severities in display order — used to zero-fill summary counts. */
const ALL_SEVERITIES: AlertSeverity[] = ['info', 'warning', 'critical', 'emergency'];

/** Default page size and safety cap for summary scans. */
const DEFAULT_LIMIT = 100;
const SUMMARY_CAP = 10_000;

/**
 * Coerce a query value (which arrives from the browser as a string) into a
 * real boolean. Accepts true booleans, 'true'/'1', 'false'/'0'. Returns
 * undefined for anything else so the filter is silently dropped.
 */
function coerceBoolean(value: boolean | string | undefined): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
}

/**
 * Coerce a query value into a non-negative integer, falling back to the
 * default for missing / non-numeric / negative values.
 */
function coerceInt(value: number | string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

@Injectable()
export class AlertQueryService {
  private readonly logger = new Logger(AlertQueryService.name);
  private readonly db: Database;

  constructor() {
    this.db = createDb();
  }

  /**
   * Full alert history for a single patient, newest first.
   *
   * @param patientId - The patient's user UUID.
   * @param query - Optional filters (severity, acknowledged, escalated, date range).
   * @returns Alert records with acknowledgment/escalation state.
   */
  async findByPatient(
    patientId: string,
    query: AlertStateQuery = {},
  ): Promise<AlertStateResponse[]> {
    const limit = coerceInt(query.limit, DEFAULT_LIMIT);
    const offset = coerceInt(query.offset, 0);

    const results = await this.db
      .select()
      .from(schema.alerts)
      .where(and(eq(schema.alerts.patientId, patientId), ...this.filterConditions(query)))
      .orderBy(desc(schema.alerts.createdAt))
      .limit(limit)
      .offset(offset);

    return results.map((row: typeof schema.alerts.$inferSelect) => this.toResponse(row));
  }

  /**
   * Filtered search across all patients — for compliance review of alert
   * handling at the clinic level.
   *
   * @param query - Optional filters (patientId, severity, ack/escalation state,
   *                date range, pagination).
   * @returns Alert records with acknowledgment/escalation state.
   */
  async findAll(query: AlertStateQuery = {}): Promise<AlertStateResponse[]> {
    const limit = coerceInt(query.limit, DEFAULT_LIMIT);
    const offset = coerceInt(query.offset, 0);

    const results = await this.db
      .select()
      .from(schema.alerts)
      .where(and(...this.filterConditions(query)))
      .orderBy(desc(schema.alerts.createdAt))
      .limit(limit)
      .offset(offset);

    return results.map((row: typeof schema.alerts.$inferSelect) => this.toResponse(row));
  }

  /**
   * Compliance summary — aggregate counts for the given scope.
   *
   * Ignores pagination (it aggregates everything in scope, capped at
   * SUMMARY_CAP rows to bound memory). Rates are computed in JS rather
   * than SQL so the logic is trivially testable.
   *
   * @param query - Optional scope filters (patientId, severity, date range).
   * @returns Summary counts + ack/escalation rates.
   */
  async summary(query: AlertStateQuery = {}): Promise<AlertStateSummary> {
    const results = await this.db
      .select()
      .from(schema.alerts)
      .where(and(...this.filterConditions(query)))
      .orderBy(desc(schema.alerts.createdAt))
      .limit(SUMMARY_CAP);

    const bySeverity: Record<AlertSeverity, number> = {
      info: 0,
      warning: 0,
      critical: 0,
      emergency: 0,
    };

    let acknowledged = 0;
    let escalated = 0;

    for (const row of results) {
      bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1;
      if (row.acknowledged) acknowledged += 1;
      if (row.escalated) escalated += 1;
    }

    const total = results.length;

    return {
      total,
      bySeverity,
      acknowledged,
      unacknowledged: total - acknowledged,
      escalated,
      ackRate: total > 0 ? acknowledged / total : 0,
      escalationRate: total > 0 ? escalated / total : 0,
    };
  }

  /**
   * Build the WHERE-clause condition list from optional query filters.
   * An empty array means "no filter" (and() with no args matches all rows).
   */
  private filterConditions(query: AlertStateQuery) {
    const conditions = [];

    if (query.patientId) {
      conditions.push(eq(schema.alerts.patientId, query.patientId));
    }

    // Query params arrive as strings from @Query(); validate the severity
    // against the enum so a bogus value never reaches the DB as a 500.
    const severity = query.severity as string | undefined;
    if (severity && (ALL_SEVERITIES as readonly string[]).includes(severity)) {
      conditions.push(eq(schema.alerts.severity, severity as AlertSeverity));
    }

    // Coerce 'true'/'false'/'1'/'0' strings (browser query params) into
    // real booleans before comparing against the boolean columns.
    const acknowledged = coerceBoolean(query.acknowledged);
    if (acknowledged !== undefined) {
      conditions.push(eq(schema.alerts.acknowledged, acknowledged));
    }
    const escalated = coerceBoolean(query.escalated);
    if (escalated !== undefined) {
      conditions.push(eq(schema.alerts.escalated, escalated));
    }
    if (query.from) {
      const from = new Date(query.from);
      if (!Number.isNaN(from.getTime())) {
        conditions.push(gte(schema.alerts.createdAt, from));
      }
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!Number.isNaN(to.getTime())) {
        conditions.push(lte(schema.alerts.createdAt, to));
      }
    }

    return conditions;
  }

  /**
   * Map a Drizzle alert row to the compliance response shape.
   * Lifts `metadata.escalatedAt` (written by the escalation sweeper) into
   * the first-class `escalatedAt` field.
   */
  private toResponse(row: typeof schema.alerts.$inferSelect): AlertStateResponse {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const escalatedAt = typeof metadata.escalatedAt === 'string' ? metadata.escalatedAt : null;

    return {
      id: row.id,
      patientId: row.patientId ?? null,
      alertType: row.alertType,
      severity: row.severity,
      message: row.message,
      acknowledged: row.acknowledged,
      acknowledgedBy: row.acknowledgedBy ?? null,
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
      escalated: row.escalated,
      escalatedAt,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
