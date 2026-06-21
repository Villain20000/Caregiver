/**
 * services/ai-rag/src/main.ts
 *
 * AI-Assisted Diagnosis Microservice (RAG Pipeline) — application entry point.
 *
 * This is the ONLY component in the platform that talks to ChromaDB and
 * Ollama. Diagnosis requests enter via Kafka and results return via Kafka —
 * no LLM calls happen on the synchronous request path.
 *
 * Pipeline flow (driven by RagConsumerService → RagPipelineService):
 *   1. Consumes `ai.diagnosis.requested` events from Kafka (produced by
 *      the API gateway on behalf of a doctor/radiologist).
 *   2. Retrieves relevant clinical context from ChromaDB (vector store)
 *      using semantic similarity search over embedded FHIR resources.
 *   3. Constructs a prompt combining the diagnosis request + retrieved
 *      context (RAG — Retrieval Augmented Generation).
 *   4. Sends the prompt to Ollama (Llama-3-8B running locally) for inference.
 *   5. Emits `ai.diagnosis.completed` with the LLM's response + source
 *      references for the doctor to review and approve/override.
 *   6. Emits `audit.event` for traceability (who requested, what was returned).
 *
 * Bootstrap: create a NestJS application context (Express platform, no HTTP
 * listener — this is a pure worker), enable shutdown hooks for graceful
 * Kafka/DB disconnect, and let the consumer's OnModuleInit start the flow.
 *
 * Key design decision: AI is a service, not a layer. This isolation means:
 *   - LLM latency never blocks the request path
 *   - The model can be swapped (Ollama → hosted API) without touching the gateway
 *   - RAG context retrieval is independently scalable
 */
// reflect-metadata polyfill — required by NestJS DI (reflect-metadata based).
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';

/** Semantic version of the ai-rag microservice. */
export const AI_RAG_VERSION = '0.1.0';

/**
 * Bootstrap function — creates the NestJS application context and lets the
 * RagConsumerService connect to Kafka on init. No HTTP port is opened.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // createApplicationContext avoids spinning up an HTTP server — this is a
  // pure Kafka-driven worker. The Express platform is still wired via
  // @nestjs/platform-express for DI consistency with the rest of the platform.
  const app = await NestFactory.create(AppModule, {
    // We don't serve HTTP, but keep the default Express adapter for DI parity.
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Enable NestJS shutdown hooks so OnModuleDestroy runs on SIGTERM/SIGINT,
  // letting the Kafka consumer disconnect and commit offsets cleanly.
  app.enableShutdownHooks();

  // No app.listen() — the consumer connects in OnModuleInit and runs the
  // Kafka poll loop for the lifetime of the process.
  logger.log(`Caregiver AI/RAG microservice v${AI_RAG_VERSION} started.`);
}

// Start the microservice. Top-level void — any bootstrap rejection is
// surfaced as an unhandled rejection and will exit the process (so the
// container orchestrator restarts it).
void bootstrap();
