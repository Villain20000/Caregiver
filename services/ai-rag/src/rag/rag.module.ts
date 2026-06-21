/**
 * services/ai-rag/src/rag/rag.module.ts
 *
 * RAG feature module — wires together all AI/RAG providers and exposes
 * the dependency-injection tokens consumed by the pipeline and consumer.
 *
 * Providers:
 *   - ChromaService         → vector store access (similarity search)
 *   - OllamaService         → local LLM inference (Ollama REST API)
 *   - RagPipelineService    → orchestrates retrieval → generation → persist → emit
 *   - RagConsumerService    → Kafka consumer for `ai.diagnosis.requested`
 *   - DATABASE              → Drizzle client (from @caregiver/db) for ai_diagnoses updates
 *   - KAFKA_PRODUCER        → typed Kafka producer for completed + audit events
 *
 * The DATABASE and KAFKA_PRODUCER tokens are exported so other modules (and
 * tests) can inject them; they are also re-imported by the pipeline/consumer
 * via this module file.
 */
import { Module, Logger } from '@nestjs/common';
import { createDb, type Database } from '@caregiver/db';
import { createProducer, type TypedProducer } from '@caregiver/kafka';
import { ChromaService } from './chroma.service.js';
import { OllamaService } from './ollama.service.js';
import { RagPipelineService } from './rag-pipeline.service.js';
import { RagConsumerService } from './rag-consumer.service.js';

/**
 * DI token for the Drizzle database instance.
 * Using a `Symbol` avoids string-typed injection key collisions.
 */
export const DATABASE = Symbol('DATABASE');

/**
 * DI token for the typed Kafka producer used to emit completed + audit events.
 */
export const KAFKA_PRODUCER = Symbol('KAFKA_PRODUCER');

/**
 * Factory: create the Drizzle client. Reads DATABASE_URL / POSTGRES_* env
 * vars via @caregiver/db's createDb defaults.
 */
function databaseFactory(): Database {
  return createDb();
}

/**
 * Factory: create and connect the typed Kafka producer. The producer stays
 * connected for the lifetime of the process and is disconnected on shutdown.
 */
async function kafkaProducerFactory(): Promise<TypedProducer> {
  const producer = createProducer('ai-rag');
  await producer.connect();
  return producer;
}

/**
 * RAG feature module.
 */
@Module({
  providers: [
    ChromaService,
    OllamaService,
    RagPipelineService,
    RagConsumerService,
    // Drizzle DB client provider.
    { provide: DATABASE, useFactory: databaseFactory },
    // Kafka producer provider (connected on init).
    { provide: KAFKA_PRODUCER, useFactory: kafkaProducerFactory },
    // Expose a logger for convenience in providers that need one.
    Logger,
  ],
  // Export the tokens so they can be injected by consumers of this module.
  exports: [DATABASE, KAFKA_PRODUCER],
})
export class RagModule {}
