/**
 * services/ai-rag/src/app.module.ts
 *
 * Root NestJS module for the AI/RAG microservice.
 *
 * This is a worker microservice — it has no HTTP controllers. The only
 * feature module is `RagModule`, which provides the ChromaDB client, the
 * Ollama client, the RAG pipeline orchestrator, and the Kafka consumer
 * that drives the whole flow from `ai.diagnosis.requested` events.
 *
 * The application context (not an HTTP server) is created in main.ts; the
 * consumer connects on module init and disconnects on shutdown.
 */
import { Module } from '@nestjs/common';
import { RagModule } from './rag/rag.module.js';

@Module({
  // Single feature module — encapsulates the entire RAG pipeline + consumer.
  imports: [RagModule],
})
export class AppModule {}
