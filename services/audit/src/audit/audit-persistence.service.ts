/**
 * services/audit/src/audit/audit-persistence.service.ts
 *
 * Append-only persistence layer for the audit log.
 *
 * This service is the SOLE writer to the `audit_log` Postgres table. It maps
 * an incoming `AuditEventPayload` (from the `audit.event` Kafka topic) to the
 * Drizzle column model and performs a single INSERT.
 *
 * CRITICAL INVARIANT — append-only:
 *   This service NEVER issues UPDATE or DELETE statements against audit_log.
 *   The audit log is write-once-read-many. Immutability is enforced both here
 *   (no update/delete methods exist) and at the database level (the audit
 *   service's DB role is granted only INSERT/SELECT on audit_log). Tampering
 *   with an audit record would be a HIPAA violation.
 *
 * Used by: AuditConsumerService (on each Kafka message).
 */
import { Injectable, Logger } from '@nestjs/common';
import { createDb, schema, type Database } from '@caregiver/db';
import type { AuditEventPayload } from '@caregiver/contracts';

/**
 * The set of role strings accepted by the `audit_log.user_role` Postgres enum
 * column. This mirrors the `roleEnum` defined in @caregiver/db and the `Role`
 * union in @caregiver/rbac. We re-declare it locally (rather than importing
 * @caregiver/rbac) to keep the audit service's dependency surface limited to
 * the three packages it actually needs.
 *
 * The cast below is safe because audit events are only produced by trusted
 * internal services that already validate the user's role at the gateway.
 */
type AuditRole =
  | 'admin'
  | 'doctor'
  | 'nurse'
  | 'patient'
  | 'radiologist'
  | 'pharmacist'
  | 'billing_specialist'
  | 'lab_tech'
  | 'auditor'
  | 'medical_director';

/**
 * Shape of a row returned from the audit_log table (read side).
 * Re-exported implicitly via the query service's return types.
 */
export type AuditLogRow = {
  id: string;
  userId: string | null;
  userRole: AuditRole | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  result: string;
  errorMessage: string | null;
  sourceIp: string | null;
  serviceName: string;
  details: Record<string, unknown> | null;
  occurredAt: Date;
};

/**
 * Append-only persistence service for audit events.
 *
 * Exposes a single mutating operation — `persist` — which inserts one row.
 * All other methods belong to the read-only AuditQueryService.
 */
@Injectable()
export class AuditPersistenceService {
  private readonly logger = new Logger('AuditPersistenceService');
  private readonly db: Database;

  constructor() {
    // Create the Drizzle client once at construction time. The connection
    // pool (managed by postgres.js inside @caregiver/db) is reused for the
    // lifetime of the process.
    this.db = createDb();
  }

  /**
   * Persist a single audit event as an immutable row in `audit_log`.
   *
   * This is an INSERT-only operation. There is intentionally no update or
   * delete path — the audit log is append-only by design.
   *
   * @param payload - The AuditEventPayload decoded from the Kafka envelope.
   * @returns The inserted row (including the generated UUID `id`).
   * @throws Rethrows any DB error so the caller (consumer) can apply retry
   *                  logic and prevent the Kafka offset from being committed.
   */
  async persist(payload: AuditEventPayload): Promise<AuditLogRow> {
    // Map the AuditEventPayload fields 1:1 to the audit_log columns.
    // Optional payload fields become `undefined`, which Drizzle translates
    // to SQL NULL for the nullable columns.
    const [inserted] = await this.db
      .insert(schema.auditLog)
      .values({
        // userId arrives as a string UUID; the column is uuid-typed, so the
        // driver encodes it. `undefined` → NULL when the action is anonymous.
        userId: payload.userId,
        // Cast the loose `string` to the strict role enum union. See the
        // AuditRole type comment above for why this is safe.
        userRole: payload.userRole as AuditRole | undefined,
        action: payload.action,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        result: payload.result,
        errorMessage: payload.errorMessage,
        sourceIp: payload.sourceIp,
        serviceName: payload.serviceName,
        details: payload.details,
        // occurredAt is an ISO 8601 string in the payload; the timestamptz
        // column accepts a string and stores it timezone-aware.
        occurredAt: new Date(payload.occurredAt),
      })
      // Return the full inserted row so callers get the generated id.
      .returning();

    // `.returning()` always yields exactly one row for a single insert, but
    // the typed result is an array — guard for safety per strict mode.
    if (!inserted) {
      // This should never happen with a healthy Postgres connection; if it
      // does, surface a clear error so the consumer retries the message.
      throw new Error('audit_log INSERT returned no rows');
    }

    this.logger.debug(
      `Persisted audit event: action=${payload.action} service=${payload.serviceName} result=${payload.result}`,
    );

    return inserted as AuditLogRow;
  }
}
