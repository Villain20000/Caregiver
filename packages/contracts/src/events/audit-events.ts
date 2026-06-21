/**
 * packages/contracts/src/events/audit-events.ts
 *
 * Event payload types for audit events.
 *
 * Topic: audit.event → every state-changing action mirrors an event here.
 * Consumed append-only by the audit microservice.
 */

/** Audit action types — what kind of action was performed. */
export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'ingest'
  | 'validate'
  | 'diagnose'
  | 'approve'
  | 'override'
  | 'export';

/** Audit result — whether the action succeeded or failed. */
export type AuditResult = 'success' | 'failure';

/** Payload for `audit.event` — a state-changing action occurred. */
export interface AuditEventPayload {
  /** Who performed the action. */
  userId?: string;
  /** The role of the user. */
  userRole?: string;
  /** What action was performed. */
  action: AuditAction;
  /** Which resource type was affected (FHIR resource type or table name). */
  resourceType?: string;
  /** Which resource ID was affected. */
  resourceId?: string;
  /** Result of the action. */
  result: AuditResult;
  /** Error message (if failed). */
  errorMessage?: string;
  /** Source IP address. */
  sourceIp?: string;
  /** Which service emitted the event. */
  serviceName: string;
  /** Additional details (JSONB). */
  details?: Record<string, unknown>;
  /** When the event occurred (ISO 8601). */
  occurredAt: string;
}
