/**
 * packages/contracts/src/dto/alert.dto.ts
 *
 * REST DTOs for the alert-state reporting API — the compliance-facing
 * read surface that answers "what happened to this alert, and did anyone
 * respond?" for auditors, medical directors, and other roles with
 * `audit.read_log`.
 *
 * These DTOs power the endpoints exposed by the API gateway:
 *   GET /api/alerts                  → search alerts with filters
 *   GET /api/alerts/patient/:id      → per-patient alert lifecycle state
 *   GET /api/alerts/summary          → compliance summary counts
 *
 * The escalation timestamp is stored in the alert's JSONB `metadata`
 * (field `escalatedAt`) by the notifications escalation sweeper, so the
 * response type surfaces it as a first-class field.
 */
import type { AlertSeverity } from '../events/alert-events.js';

/**
 * Query parameters for GET /api/alerts — all optional.
 * `acknowledged` / `escalated` are booleans; `from` / `to` are ISO 8601
 * createdAt bounds; `limit` / `offset` paginate the result list.
 */
export interface AlertStateQuery {
  /** Only alerts for this patient (also used by /patient/:id). */
  patientId?: string;
  /** Only alerts of this severity (info | warning | critical | emergency). */
  severity?: AlertSeverity;
  /** Only acknowledged (true) or unacknowledged (false) alerts. */
  acknowledged?: boolean;
  /** Only escalated (true) or never-escalated (false) alerts. */
  escalated?: boolean;
  /** Only alerts created at or after this ISO timestamp. */
  from?: string;
  /** Only alerts created at or before this ISO timestamp. */
  to?: string;
  /** Max rows to return (default 100). */
  limit?: number;
  /** Row offset for pagination (default 0). */
  offset?: number;
}

/**
 * Full alert record with its acknowledgment + escalation lifecycle state.
 * This is what a compliance reviewer sees for a single alert.
 */
export interface AlertStateResponse {
  /** Alert UUID. */
  id: string;
  /** The patient the alert is about (null if never assigned). */
  patientId: string | null;
  /** Alert type slug (e.g. vital_threshold, appointment_reminder). */
  alertType: string;
  /** Severity level. */
  severity: AlertSeverity;
  /** Human-readable alert message. */
  message: string;
  /** Whether a user acknowledged the alert. */
  acknowledged: boolean;
  /** Who acknowledged it (user UUID). */
  acknowledgedBy: string | null;
  /** When it was acknowledged (ISO 8601). */
  acknowledgedAt: string | null;
  /** Whether the escalation sweeper escalated this alert. */
  escalated: boolean;
  /** When it was escalated (ISO 8601, read from metadata.escalatedAt). */
  escalatedAt: string | null;
  /** Raw alert metadata (JSONB). */
  metadata: Record<string, unknown> | null;
  /** When the alert was created (ISO 8601). */
  createdAt: string;
}

/**
 * Compliance summary — aggregate acknowledgment/escalation counts for a
 * patient (or across all alerts when no patient filter is applied).
 *
 * `ackRate` and `escalationRate` are 0–1 fractions (0 when total = 0), so
 * dashboards can render them as percentages directly.
 */
export interface AlertStateSummary {
  /** Total number of alerts in scope. */
  total: number;
  /** Count per severity level (all four keys always present). */
  bySeverity: Record<AlertSeverity, number>;
  /** Number acknowledged by a user. */
  acknowledged: number;
  /** Number still unacknowledged (open / unresolved). */
  unacknowledged: number;
  /** Number escalated by the escalation sweeper. */
  escalated: number;
  /** acknowledged / total (0–1). */
  ackRate: number;
  /** escalated / total (0–1). */
  escalationRate: number;
}
