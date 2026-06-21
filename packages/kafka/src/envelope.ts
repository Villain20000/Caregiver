/**
 * packages/kafka/src/envelope.ts
 *
 * Kafka event envelope — the standard wrapper for all messages on the bus.
 *
 * Every event produced to Kafka is wrapped in this envelope. It provides:
 *   - Event ID (UUID) for deduplication and tracing
 *   - Event type (the topic name, for self-describing messages)
 *   - Timestamp (when the event was produced)
 *   - Source (which service produced the event)
 *   - Correlation ID (for distributed tracing across services)
 *   - User ID + role (who triggered the event, for audit)
 *   - Payload (the actual event data, typed per topic)
 *
 * The `KafkaMessage` type is a generic that binds the payload type to
 * a specific topic, enabling end-to-end type safety.
 */
import type { KafkaTopic } from './topics.js';

/**
 * Standard envelope wrapping all Kafka events.
 * Generic `P` is the payload type (specific to each topic).
 */
export interface KafkaEnvelope<P = unknown> {
  /** Unique event ID (UUID) for deduplication and idempotency. */
  eventId: string;
  /** The topic this event was published to (self-describing). */
  eventType: KafkaTopic;
  /** When the event was produced (ISO 8601 with timezone). */
  timestamp: string;
  /** Which service produced the event (e.g. 'api-gateway', 'fhir-ingestion'). */
  source: string;
  /** Correlation ID for distributed tracing across services. */
  correlationId?: string;
  /** The user who triggered the event (for audit trail). */
  userId?: string;
  /** The role of the user who triggered the event. */
  userRole?: string;
  /** The actual event payload (topic-specific). */
  payload: P;
}

/**
 * A typed Kafka message — binds a topic to its payload type.
 * Used by the typed producer/consumer helpers to ensure type safety.
 *
 * @example
 *   type DiagnosisRequested = KafkaMessage<'ai.diagnosis.requested', {
 *     patientId: string;
 *     requestedBy: string;
 *     inputContext: string;
 *   }>;
 */
export type KafkaMessage<T extends KafkaTopic, P = unknown> = {
  topic: T;
  envelope: KafkaEnvelope<P>;
};
