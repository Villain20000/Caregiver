/**
 * packages/kafka/src/client.ts
 *
 * KafkaJS client factory.
 *
 * Creates a KafkaJS client configured from environment variables:
 *   - KAFKA_BROKERS (comma-separated list of broker addresses)
 *   - KAFKA_CLIENT_ID (client identifier for logging/tracking)
 *
 * The client is the foundation for creating producers and consumers.
 */
import { Kafka, type KafkaConfig } from 'kafkajs';

/**
 * Create a KafkaJS client instance.
 *
 * Reads configuration from environment variables with sensible defaults
 * for local development.
 *
 * @param overrides - Optional config overrides (e.g. for testing).
 * @returns A KafkaJS client instance.
 *
 * @example
 *   import { createKafkaClient } from '@caregiver/kafka';
 *   const kafka = createKafkaClient();
 *   const producer = kafka.producer();
 *   const consumer = kafka.consumer({ groupId: 'my-service' });
 */
export function createKafkaClient(overrides?: Partial<KafkaConfig>): Kafka {
  // Parse KAFKA_BROKERS env var (comma-separated).
  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092')
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);

  const clientId = process.env.KAFKA_CLIENT_ID ?? 'caregiver';

  return new Kafka({
    clientId,
    brokers,
    ...overrides,
  });
}
