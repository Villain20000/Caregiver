/**
 * packages/contracts/src/events/alert-events.ts
 *
 * Event payload types for alert events.
 *
 * Topic: alert.dispatched → emitted when a threshold breach or critical event occurs.
 * The same topic carries TWO dispatch kinds:
 *   1. Initial dispatch — emitted by the notifications service when an alert
 *      is first created (escalated is absent/undefined).
 *   2. Escalation dispatch — re-emitted by the escalation sweeper when a
 *      critical/emergency alert goes unacknowledged past the timeout
 *      (escalated: true, severity forced to 'emergency').
 */

/** Alert severity levels. */
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

/** Payload for `alert.dispatched` — an alert was generated and needs delivery. */
export interface AlertDispatchedPayload {
  /** The database UUID of the alert. */
  alertId: string;
  /** The patient the alert is about. */
  patientId: string;
  /** The type of alert (vital_threshold, critical_lab, etc.). */
  alertType: string;
  /** Severity level. */
  severity: AlertSeverity;
  /** Human-readable alert message. */
  message: string;
  /** Target role(s) that should receive this alert. */
  targetRoles: string[];
  /**
   * True when this is an escalation re-dispatch of an already-created alert
   * that went unacknowledged past the escalation timeout. Escalations force
   * severity to 'emergency' and widen targetRoles to senior staff + admin.
   */
  escalated?: boolean;
  /** Additional metadata (e.g. which vital breached, threshold values). */
  metadata?: Record<string, unknown>;
  /** When the alert was created (ISO 8601). */
  createdAt: string;
}

/**
 * Payload for `alert.acknowledged` — a user acknowledged an alert.
 *
 * Emitted by the API gateway's Socket.io handler when a clinician clicks
 * the dismiss/acknowledge button. The notifications service consumes this
 * to persist `acknowledged/acknowledgedBy/acknowledgedAt` on the alert row
 * — the gateway never writes the DB directly (BFF pattern).
 */
export interface AlertAcknowledgedPayload {
  /** The database UUID of the acknowledged alert. */
  alertId: string;
  /** UUID of the user who acknowledged it. */
  acknowledgedBy: string;
  /** When the acknowledgment happened (ISO 8601). */
  acknowledgedAt: string;
}
