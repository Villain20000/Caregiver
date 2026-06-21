/**
 * packages/kafka/src/producer.ts
 *
 * Typed Kafka producer helper.
 *
 * Wraps the KafkaJS producer with:
 *   - Automatic JSON serialization (envelope → JSON string)
 *   - Type-safe `send` method that binds payload types to topics
 *   - Automatic envelope creation (eventId, timestamp, source)
 *   - Connection management (connect/disconnect)
 */
import type { Producer, RecordMetadata } from 'kafkajs';
import { createKafkaClient } from './client.js';
import type { KafkaEnvelope } from './envelope.js';
import type { KafkaTopic } from './topics.js';

/** Type alias for the typed producer returned by `createProducer`. */
export interface TypedProducer {
  /** Connect to the Kafka cluster. Must be called before `send`. */
  connect(): Promise<void>;
  /** Disconnect from the Kafka cluster. Call on graceful shutdown. */
  disconnect(): Promise<void>;
  /**
   * Send a typed event to a Kafka topic.
   *
   * @param topic - The topic to send to (must be in KAFKA_TOPICS).
   * @param payload - The event payload (type-safe per topic).
   * @param metadata - Optional envelope metadata (userId, correlationId, etc.).
   * @returns Kafka record metadata (partition, offset, etc.).
   */
  send<P>(
    topic: KafkaTopic,
    payload: P,
    metadata?: Partial<Omit<KafkaEnvelope<P>, 'payload'>>,
  ): Promise<RecordMetadata[]>;
}

/**
 * Create a typed Kafka producer.
 *
 * @param source - The name of the service producing events (e.g. 'api-gateway').
 *                  This is embedded in every event envelope for traceability.
 * @returns A typed producer with connect/disconnect/send methods.
 *
 * @example
 *   const producer = createProducer('api-gateway');
 *   await producer.connect();
 *   await producer.send('appointment.created', {
 *     patientId: 'p-123',
 *     practitionerId: 'd-456',
 *     start: '2026-06-21T10:00:00Z',
 *   }, { userId: 'd-456', userRole: 'doctor' });
 */
export function createProducer(source: string): TypedProducer {
  const kafka = createKafkaClient();
  const producer: Producer = kafka.producer({
    // Retry on transient failures.
    retry: {
      initialRetryTime: 100,
      retries: 5,
    },
  });

  return {
    async connect(): Promise<void> {
      await producer.connect();
    },

    async disconnect(): Promise<void> {
      await producer.disconnect();
    },

    async send<P>(
      topic: KafkaTopic,
      payload: P,
      metadata?: Partial<Omit<KafkaEnvelope<P>, 'payload'>>,
    ): Promise<RecordMetadata[]> {
      // Build the full envelope with auto-generated fields.
      const envelope: KafkaEnvelope<P> = {
        eventId: crypto.randomUUID(),
        eventType: topic,
        timestamp: new Date().toISOString(),
        source,
        ...metadata,
        payload,
      };

      // Serialize and send.
      return producer.send({
        topic,
        messages: [
          {
            key: metadata?.correlationId ?? envelope.eventId,
            value: JSON.stringify(envelope),
          },
        ],
      });
    },
  };
}
