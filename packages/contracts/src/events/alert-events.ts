/**
 * packages/contracts/src/events/alert-events.ts
 *
 * Event payload types for alert events.
 *
 * Topic: alert.dispatched → emitted when a threshold breach or critical event occurs.
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
  /** Additional metadata (e.g. which vital breached, threshold values). */
  metadata?: Record<string, unknown>;
  /** When the alert was created (ISO 8601). */
  createdAt: string;
}
