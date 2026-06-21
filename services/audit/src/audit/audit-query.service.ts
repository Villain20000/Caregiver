/**
 * services/audit/src/audit/audit-query.service.ts
 *
 * Read-only query service for the audit log.
 *
 * Exposes filtered retrieval of audit_log rows for the Auditor and Medical
 * Director roles, who access audit data through the API gateway. This
 * service performs ONLY SELECT queries — it never mutates the audit log
 * (append-only invariant; all writes flow through AuditPersistenceService).
 *
 * Query helpers provided:
 *   - getByUser(userId)                       → all actions by a user
 *   - getByResource(resourceType, resourceId) → full history of one resource
 *   - getByDateRange(start, end)              → events within a time window
 *   - getByAction(action)                     → all events of a given action
 *
 * Results are ordered by `occurredAt` descending (most recent first) and
 * limited to a sane default to keep auditor dashboards responsive.
 */
import { Injectable, Logger } from '@nestjs/common';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { createDb, schema, type Database } from '@caregiver/db';
import type { AuditLogRow } from './audit-persistence.service.js';

/**
 * Default page size for audit queries. Audit logs can grow very large, so we
 * cap every query to avoid pulling the entire table into memory. The API
 * gateway layers explicit pagination on top of this.
 */
const DEFAULT_LIMIT = 100;

/**
 * Read-only audit log query service.
 *
 * All methods return `AuditLogRow[]` ordered by `occurredAt DESC`. None of
 * them mutate the database.
 */
@Injectable()
export class AuditQueryService {
  private readonly logger = new Logger('AuditQueryService');
  private readonly db: Database;

  constructor() {
    // Reuse the same Drizzle client factory. The postgres.js pool is shared
    // across connections in-process; for high-throughput audit reads the
    // gateway could inject a dedicated read replica, but for now the single
    // client is sufficient.
    this.db = createDb();
  }

  /**
   * Retrieve all audit events performed by a given user, newest first.
   *
   * @param userId - The UUID of the user whose actions are being audited.
   * @param limit  - Optional row cap (defaults to DEFAULT_LIMIT).
   */
  async getByUser(userId: string, limit: number = DEFAULT_LIMIT): Promise<AuditLogRow[]> {
    this.logger.debug(`Querying audit log by user=${userId} limit=${limit}`);
    const rows = await this.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.userId, userId))
      .orderBy(desc(schema.auditLog.occurredAt))
      .limit(limit);
    return rows as AuditLogRow[];
  }

  /**
   * Retrieve the full audit history of a single resource, newest first.
   *
   * Useful for compliance review of a specific FHIR resource or record —
   * shows every create/read/update/delete/export touching it.
   *
   * @param resourceType - The FHIR resource type or table name.
   * @param resourceId   - The resource's identifier.
   * @param limit        - Optional row cap (defaults to DEFAULT_LIMIT).
   */
  async getByResource(
    resourceType: string,
    resourceId: string,
    limit: number = DEFAULT_LIMIT,
  ): Promise<AuditLogRow[]> {
    this.logger.debug(
      `Querying audit log by resource=${resourceType}/${resourceId} limit=${limit}`,
    );
    // Combine the two equality predicates with AND — both must match.
    const rows = await this.db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.resourceType, resourceType),
          eq(schema.auditLog.resourceId, resourceId),
        ),
      )
      .orderBy(desc(schema.auditLog.occurredAt))
      .limit(limit);
    return rows as AuditLogRow[];
  }

  /**
   * Retrieve audit events that occurred within a [start, end] time window,
   * newest first. Both bounds are inclusive (gte / lte).
   *
   * @param start - Inclusive lower bound (ISO 8601 string or Date).
   * @param end   - Inclusive upper bound (ISO 8601 string or Date).
   * @param limit - Optional row cap (defaults to DEFAULT_LIMIT).
   */
  async getByDateRange(
    start: string | Date,
    end: string | Date,
    limit: number = DEFAULT_LIMIT,
  ): Promise<AuditLogRow[]> {
    this.logger.debug(`Querying audit log by date range [${start}, ${end}] limit=${limit}`);
    // Normalize to Date objects — the timestamptz column compares correctly
    // against JS Date values via the postgres.js driver.
    const startFilter = gte(schema.auditLog.occurredAt, new Date(start));
    const endFilter = lte(schema.auditLog.occurredAt, new Date(end));
    const rows = await this.db
      .select()
      .from(schema.auditLog)
      .where(and(startFilter, endFilter))
      .orderBy(desc(schema.auditLog.occurredAt))
      .limit(limit);
    return rows as AuditLogRow[];
  }

  /**
   * Retrieve all audit events of a specific action type (e.g. 'login',
   * 'delete', 'export'), newest first. Common for security reviews — e.g.
   * "show me every export in the last 24h".
   *
   * @param action - The action name (see AuditAction in @caregiver/contracts).
   * @param limit  - Optional row cap (defaults to DEFAULT_LIMIT).
   */
  async getByAction(action: string, limit: number = DEFAULT_LIMIT): Promise<AuditLogRow[]> {
    this.logger.debug(`Querying audit log by action=${action} limit=${limit}`);
    const rows = await this.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, action))
      .orderBy(desc(schema.auditLog.occurredAt))
      .limit(limit);
    return rows as AuditLogRow[];
  }
}
