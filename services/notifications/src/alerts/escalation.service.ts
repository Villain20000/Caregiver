/**
 * services/notifications/src/alerts/escalation.service.ts
 *
 * Alert escalation sweeper — the safety net for unacknowledged alerts.
 *
 * When a critical or emergency alert is created, it is dispatched to the
 * senior clinical roles (doctor, nurse, medical_director). If nobody
 * acknowledges it within the escalation timeout, patient safety demands
 * that the alert be pushed again with more urgency and wider visibility.
 *
 * Responsibilities:
 *   1. On module init, start a polling interval (ALERT_ESCALATION_POLL_MS).
 *   2. Each poll, find alerts that are:
 *        - severity critical OR emergency
 *        - not yet acknowledged
 *        - not yet escalated
 *        - older than ALERT_ESCALATION_TIMEOUT_MS
 *   3. For each due alert, mark `escalated = true` in the DB (storing the
 *      escalation timestamp in metadata) and re-dispatch the alert on
 *      `alert.dispatched` with:
 *        - `escalated: true` (so the UI can render it distinctly)
 *        - severity forced to 'emergency'
 *        - widened target roles (doctor, nurse, medical_director, admin)
 *   4. Mirror the escalation to `audit.event` for the compliance trail.
 *
 * Config (env vars, all optional):
 *   - ALERT_ESCALATION_TIMEOUT_MS — unacknowledged age before escalation
 *     (default 15 minutes).
 *   - ALERT_ESCALATION_POLL_MS    — how often the sweeper runs
 *     (default 30 seconds).
 *
 * Testability: the eligibility check (`isEligibleForEscalation`) and the
 * payload builder (`escalationPayloadFor`) are pure, exported functions so
 * they can be unit-tested without a database or Kafka connection.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { and, eq, inArray, lt } from 'drizzle-orm';
import { schema, type Database } from '@caregiver/db';
import type { TypedProducer } from '@caregiver/kafka';
import type {
  AlertSeverity,
  AlertDispatchedPayload,
  AuditEventPayload,
} from '@caregiver/contracts';
import { DATABASE, KAFKA_PRODUCER } from './alert.service.js';

/** Default escalation timeout: 15 minutes. */
const DEFAULT_ESCALATION_TIMEOUT_MS = 15 * 60 * 1000;
/** Default sweeper poll interval: 30 seconds. */
const DEFAULT_ESCALATION_POLL_MS = 30 * 1000;

/**
 * Roles that receive an escalated alert. Wider than the initial dispatch
 * (which tops out at medical_director) — escalations also reach admin so
 * someone with system-level visibility is always in the loop.
 */
export const ESCALATION_TARGET_ROLES = ['doctor', 'nurse', 'medical_director', 'admin'] as const;

/**
 * The subset of an `alerts` row the escalation logic needs.
 * Extracted as a structural type so the pure helpers are testable without
 * constructing the full Drizzle row type.
 */
export interface EscalatableAlertRow {
  id: string;
  patientId: string | null;
  alertType: string;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  escalated: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Read the escalation timeout from the environment with a sane default.
 * Returns the default when the env var is missing or not a finite number.
 */
export function escalationTimeoutMs(): number {
  const raw = process.env.ALERT_ESCALATION_TIMEOUT_MS;
  if (raw === undefined || raw === '') return DEFAULT_ESCALATION_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_ESCALATION_TIMEOUT_MS;
}

/**
 * Read the sweeper poll interval from the environment with a sane default.
 */
export function escalationPollMs(): number {
  const raw = process.env.ALERT_ESCALATION_POLL_MS;
  if (raw === undefined || raw === '') return DEFAULT_ESCALATION_POLL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_ESCALATION_POLL_MS;
}

/**
 * Pure eligibility check — should this alert be escalated now?
 *
 * @param row - The alert row under consideration.
 * @param cutoff - Alerts created before this instant are considered "stale".
 * @returns True when the alert is unacknowledged, not already escalated,
 *          and older than the cutoff.
 */
export function isEligibleForEscalation(row: EscalatableAlertRow, cutoff: Date): boolean {
  return !row.acknowledged && !row.escalated && row.createdAt.getTime() < cutoff.getTime();
}

/**
 * Pure payload builder — construct the `alert.dispatched` escalation event.
 *
 * Forces severity to 'emergency', prefixes the message with "ESCALATED:",
 * and records the escalation timestamp + original severity in metadata so
 * downstream consumers (UI, audit) can trace the escalation chain.
 *
 * @param row - The alert being escalated.
 * @param escalatedAt - ISO timestamp of the escalation. Threaded in from the
 *                      caller so the DB metadata write and the dispatched
 *                      payload always carry the SAME timestamp (defaults to
 *                      now for standalone use / tests).
 */
export function escalationPayloadFor(
  row: EscalatableAlertRow,
  escalatedAt: string = new Date().toISOString(),
): AlertDispatchedPayload {
  return {
    alertId: row.id,
    patientId: row.patientId ?? 'unknown',
    alertType: row.alertType,
    severity: 'emergency',
    message: `ESCALATED: ${row.message}`,
    targetRoles: [...ESCALATION_TARGET_ROLES],
    escalated: true,
    metadata: {
      ...(row.metadata ?? {}),
      escalated: true,
      escalatedAt,
      originalSeverity: row.severity,
    },
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class EscalationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EscalationService.name);

  /** Handle for the poll timer so it can be cleared on shutdown. */
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(KAFKA_PRODUCER) private readonly producer: TypedProducer,
  ) {}

  onModuleInit(): void {
    const pollMs = escalationPollMs();
    // unref() lets the process exit naturally if the only thing keeping it
    // alive would be this timer (irrelevant here — Kafka holds it open —
    // but good hygiene for test runs).
    this.pollTimer = setInterval(() => {
      void this.checkDueEscalations();
    }, pollMs);
    this.pollTimer.unref?.();

    this.logger.log(
      `Escalation sweeper started (poll ${pollMs}ms, timeout ${escalationTimeoutMs()}ms).`,
    );
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.logger.log('Escalation sweeper stopped.');
  }

  /**
   * Find and escalate all due alerts. Public so it can be driven directly
   * in tests (and by operators who want to force a sweep).
   *
   * @returns The number of alerts escalated in this sweep.
   */
  async checkDueEscalations(): Promise<number> {
    const cutoff = new Date(Date.now() - escalationTimeoutMs());

    // Query: unacknowledged, not-yet-escalated critical/emergency alerts
    // created before the cutoff.
    const rows = await this.db
      .select()
      .from(schema.alerts)
      .where(
        and(
          eq(schema.alerts.acknowledged, false),
          eq(schema.alerts.escalated, false),
          lt(schema.alerts.createdAt, cutoff),
          inArray(schema.alerts.severity, ['critical', 'emergency']),
        ),
      );

    let escalatedCount = 0;
    for (const row of rows) {
      const alertRow = row as EscalatableAlertRow;
      // Belt-and-braces: re-check eligibility (e.g. the row may have been
      // acknowledged between the query and this iteration).
      if (!isEligibleForEscalation(alertRow, cutoff)) continue;
      await this.escalateAlert(alertRow);
      escalatedCount += 1;
    }

    if (escalatedCount > 0) {
      this.logger.warn(`Escalated ${escalatedCount} unacknowledged alert(s).`);
    }
    return escalatedCount;
  }

  /**
   * Escalate a single alert: mark it escalated in the DB, re-dispatch it
   * on `alert.dispatched` (escalated: true), and mirror to the audit trail.
   */
  async escalateAlert(row: EscalatableAlertRow): Promise<void> {
    const escalatedAt = new Date().toISOString();

    // Mark the alert escalated and record when it happened (metadata keeps
    // the schema unchanged — the `escalated` boolean + JSONB already exist).
    await this.db
      .update(schema.alerts)
      .set({
        escalated: true,
        metadata: {
          ...(row.metadata ?? {}),
          escalatedAt,
        },
      })
      .where(eq(schema.alerts.id, row.id));

    // Re-dispatch on the same topic the gateway consumes — the API gateway
    // broadcasts it to the (now wider) target roles over Socket.io. Thread
    // the same escalatedAt through so DB metadata and payload agree.
    const payload = escalationPayloadFor(row, escalatedAt);
    await this.producer.send('alert.dispatched', payload, {
      correlationId: row.id,
    });

    // Mirror to the compliance audit trail.
    const auditPayload: AuditEventPayload = {
      action: 'update',
      resourceType: 'alerts',
      resourceId: row.id,
      result: 'success',
      serviceName: 'notifications',
      details: {
        escalated: true,
        escalatedAt,
        originalSeverity: row.severity,
        targetRoles: [...ESCALATION_TARGET_ROLES],
      },
      occurredAt: escalatedAt,
    };
    await this.producer.send('audit.event', auditPayload, {
      correlationId: row.id,
    });

    this.logger.warn(
      `Alert ${row.id} escalated (${row.severity} → emergency, roles: ${ESCALATION_TARGET_ROLES.join(', ')}).`,
    );
  }
}
