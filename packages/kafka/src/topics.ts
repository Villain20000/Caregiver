/**
 * packages/kafka/src/topics.ts
 *
 * Canonical Kafka topic registry for the Caregiver platform.
 *
 * This is the single source of truth for all event stream names.
 * Every producer and consumer in the platform references topics from here.
 *
 * Topic naming convention: `<domain>.<entity>.<action>` (dot-separated).
 * This makes it easy to:
 *   - Filter by domain in Kafka UI tools
 *   - Set up topic-level ACLs
 *   - Understand event flow at a glance
 */

/**
 * Canonical list of all Kafka topics used by the platform.
 * `as const` ensures the `KafkaTopic` type is a strict union.
 */
export const KAFKA_TOPICS = [
  // ── FHIR domain — resource lifecycle events ───────────────
  /** Emitted by API gateway when an external FHIR bundle arrives. */
  'fhir.resource.ingested',
  /** Emitted by fhir-ingestion after R4 validation passes. */
  'fhir.resource.validated',

  // ── Appointment domain ────────────────────────────────────
  /** Emitted when a new appointment is scheduled. */
  'appointment.created',
  /** Emitted when an appointment is rescheduled or cancelled. */
  'appointment.updated',

  // ── Clinical observations ─────────────────────────────────
  /** Emitted when a nurse/doctor records patient vitals. */
  'vitals.recorded',

  // ── Alert domain ──────────────────────────────────────────
  /** Emitted when a threshold breach or critical event occurs. */
  'alert.dispatched',

  // ── AI domain — diagnosis pipeline ────────────────────────
  /** Emitted by API gateway on behalf of a doctor requesting AI diagnosis. */
  'ai.diagnosis.requested',
  /** Emitted by ai-rag after LLM + RAG processing completes. */
  'ai.diagnosis.completed',

  // ── Order domain ──────────────────────────────────────────
  /** Emitted when a new order is created (lab, imaging, medication). */
  'order.created',
  /** Emitted when an order is filled by a pharmacist. */
  'order.filled',
  /** Emitted when a medication is dispensed. */
  'order.dispensed',

  // ── Claim domain ──────────────────────────────────────────
  /** Emitted when a new insurance claim is created. */
  'claim.created',
  /** Emitted when a claim is submitted to an insurer. */
  'claim.submitted',
  /** Emitted when a claim is adjudicated. */
  'claim.adjudicated',
  /** Emitted when a payment is posted. */
  'payment.posted',

  // ── Audit domain ──────────────────────────────────────────
  /** Every state-changing event is mirrored here for the audit microservice. */
  'audit.event',
] as const;

/** Union type of all valid Kafka topic names. */
export type KafkaTopic = (typeof KAFKA_TOPICS)[number];
