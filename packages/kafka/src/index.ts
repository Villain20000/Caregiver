/**
 * packages/kafka/src/index.ts
 *
 * Public API for the @caregiver/kafka package.
 *
 * Exports:
 *   - Topic registry (KAFKA_TOPICS, KafkaTopic)
 *   - Kafka client factory (createKafkaClient)
 *   - Typed producer helper (createProducer)
 *   - Typed consumer helper (createConsumer)
 *   - Event envelope type (KafkaEnvelope)
 */

// ── Topic registry ───────────────────────────────────────────
export { KAFKA_TOPICS, type KafkaTopic } from './topics.js';

// ── Event envelope ───────────────────────────────────────────
export { type KafkaEnvelope, type KafkaMessage } from './envelope.js';

// ── Client factory + producer/consumer helpers ───────────────
export { createKafkaClient } from './client.js';
export { createProducer, type TypedProducer } from './producer.js';
export { createConsumer, type TypedConsumer } from './consumer.js';
