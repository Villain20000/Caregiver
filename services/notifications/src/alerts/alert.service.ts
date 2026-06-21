/**
 * services/notifications/src/alerts/alert.service.ts
 *
 * Alert creation + dispatch service.
 *
 * Responsibilities:
 *   1. Persist a new alert row to the `alerts` Postgres table (via Drizzle).
 *   2. Determine which clinical roles should receive the alert based on
 *      severity (critical/emergency → doctor + nurse + medical_director;
 *      warning → nurse; info → patient).
 *   3. Emit an `alert.dispatched` Kafka event so the API gateway can fan
 *      the alert out to connected frontend clients over Socket.io.
 *   4. Emit an `audit.event` Kafka event for the compliance audit trail.
 *
 * The Drizzle `insert().returning()` call yields the generated UUID; the
 * possible `undefined` result (no rows returned) is guarded with a null
 * check so we never dispatch an alert with a missing ID.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Database } from '@caregiver/db';
import { schema } from '@caregiver/db';
import type { TypedProducer } from '@caregiver/kafka';
import type {
  AlertSeverity,
  AlertDispatchedPayload,
  AuditEventPayload,
} from '@caregiver/contracts';

/** Injection token for the Drizzle database instance (provided by NotificationsModule). */
export const DATABASE = Symbol('DATABASE');

/** Injection token for the typed Kafka producer (provided by NotificationsModule). */
export const KAFKA_PRODUCER = Symbol('KAFKA_PRODUCER');

/** Parameters for creating + dispatching an alert. */
export interface CreateAlertParams {
  /** The patient the alert is about. */
  patientId: string;
  /** Alert type slug (e.g. 'vital_threshold', 'appointment_reminder'). */
  alertType: string;
  /** Severity level — drives target role selection. */
  severity: AlertSeverity;
  /** Human-readable alert message. */
  message: string;
  /** Optional metadata stored as JSONB on the alert row. */
  metadata?: Record<string, unknown>;
}

/**
 * Map a severity to the roles that should receive the alert.
 *
 * - critical/emergency → escalate to senior clinical staff (doctor, nurse,
 *   medical_director) so the patient gets immediate attention.
 * - warning → nursing staff for monitoring.
 * - info → the patient themselves (e.g. appointment reminders).
 */
export function targetRolesForSeverity(severity: AlertSeverity): string[] {
  switch (severity) {
    case 'critical':
    case 'emergency':
      return ['doctor', 'nurse', 'medical_director'];
    case 'warning':
      return ['nurse'];
    case 'info':
    default:
      return ['patient'];
  }
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(KAFKA_PRODUCER) private readonly producer: TypedProducer,
  ) {}

  /**
   * Persist an alert and dispatch it via Kafka.
   *
   * @param params - Alert creation parameters.
   * @returns The created alert's UUID, or `null` if persistence failed.
   */
  async createAndDispatch(params: CreateAlertParams): Promise<string | null> {
    const { patientId, alertType, severity, message, metadata } = params;
    const targetRoles = targetRolesForSeverity(severity);

    // Insert the alert row and return the generated columns (including id).
    // Drizzle returns an array; with strict index access the first element
    // may be undefined, so we guard explicitly.
    const inserted = await this.db
      .insert(schema.alerts)
      .values({
        patientId,
        alertType,
        severity,
        message,
        metadata,
      })
      .returning();

    const row = inserted[0];
    if (!row) {
      // Should never happen with a healthy Postgres, but defend against it
      // rather than dispatching an event with a missing alertId.
      this.logger.error(
        `Alert insert returned no rows (patient ${patientId}, type ${alertType}). Dispatch aborted.`,
      );
      return null;
    }

    const alertId = row.id;
    const createdAt = row.createdAt.toISOString();

    // Build the alert.dispatched payload for the API gateway to fan out.
    const dispatchPayload: AlertDispatchedPayload = {
      alertId,
      patientId,
      alertType,
      severity,
      message,
      targetRoles,
      metadata,
      createdAt,
    };

    // Emit the alert to Kafka — the API gateway consumes this and forwards
    // to the appropriate Socket.io role rooms.
    await this.producer.send('alert.dispatched', dispatchPayload, {
      correlationId: alertId,
    });

    this.logger.log(
      `Alert ${alertId} dispatched [${severity}] → roles: ${targetRoles.join(', ')}`,
    );

    // Mirror to the audit trail for HIPAA compliance tracking.
    const auditPayload: AuditEventPayload = {
      action: 'create',
      resourceType: 'alerts',
      resourceId: alertId,
      result: 'success',
      serviceName: 'notifications',
      details: { severity, alertType, targetRoles },
      occurredAt: createdAt,
    };
    await this.producer.send('audit.event', auditPayload, {
      correlationId: alertId,
    });

    return alertId;
  }
}
