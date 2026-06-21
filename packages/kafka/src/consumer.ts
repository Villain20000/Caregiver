/**
 * packages/kafka/src/consumer.ts
 *
 * Typed Kafka consumer helper.
 *
 * Wraps the KafkaJS consumer with:
 *   - Automatic JSON deserialization (JSON string → envelope)
 *   - Type-safe message handler signature
 *   - Connection management (connect/disconnect)
 *   - Graceful shutdown support
 */
import type { Consumer, EachMessagePayload } from 'kafkajs';
import { createKafkaClient } from './client.js';
import type { KafkaEnvelope } from './envelope.js';
import type { KafkaTopic } from './topics.js';

/** Type alias for the typed consumer returned by `createConsumer`. */
export interface TypedConsumer {
  /** Connect to the Kafka cluster and join the consumer group. */
  connect(): Promise<void>;
  /** Disconnect from the Kafka cluster. Call on graceful shutdown. */
  disconnect(): Promise<void>;
  /**
   * Subscribe to a topic and process messages.
   *
   * @param topic - The topic to subscribe to.
   * @param handler - Async function called for each message.
   *                   If it throws, the message is not committed (retried).
   */
  subscribe<P>(
    topic: KafkaTopic,
    handler: (envelope: KafkaEnvelope<P>) => Promise<void>,
  ): Promise<void>;
  /** Stop consuming messages (for graceful shutdown). */
  stop(): Promise<void>;
}

/**
 * Create a typed Kafka consumer.
 *
 * @param groupId - The consumer group ID. All instances with the same
 *                   groupId share topic partitions (horizontal scaling).
 * @returns A typed consumer with connect/disconnect/subscribe methods.
 *
 * @example
 *   const consumer = createConsumer('caregiver-fhir');
 *   await consumer.connect();
 *   await consumer.subscribe('fhir.resource.ingested', async (envelope) => {
 *     console.log('Received FHIR bundle:', envelope.payload);
 *     // Validate and persist...
 *   });
 */
export function createConsumer(groupId: string): TypedConsumer {
  const kafka = createKafkaClient();
  const consumer: Consumer = kafka.consumer({
    groupId,
  });

  let running = false;

  return {
    async connect(): Promise<void> {
      await consumer.connect();
    },

    async disconnect(): Promise<void> {
      running = false;
      await consumer.disconnect();
    },

    async stop(): Promise<void> {
      running = false;
      await consumer.stop();
    },

    async subscribe<P>(
      topic: KafkaTopic,
      handler: (envelope: KafkaEnvelope<P>) => Promise<void>,
    ): Promise<void> {
      await consumer.subscribe({ topic, fromBeginning: true });
      running = true;

      // Run the consumer loop. Each message is deserialized and passed
      // to the handler. If the handler throws, the message is NOT committed
      // and will be redelivered (at-least-once semantics).
      await consumer.run({
        eachMessage: async ({ message }: EachMessagePayload) => {
          if (!running) return;

          // Deserialize the JSON envelope.
          const value = message.value?.toString();
          if (!value) {
            console.warn(`[kafka] Empty message on topic '${topic}', skipping.`);
            return;
          }

          try {
            const envelope = JSON.parse(value) as KafkaEnvelope<P>;
            await handler(envelope);
          } catch (error) {
            console.error(`[kafka] Error processing message on '${topic}':`, error);
            // Re-throw so KafkaJS knows the message was not processed.
            throw error;
          }
        },
      });
    },
  };
}
