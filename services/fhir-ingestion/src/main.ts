/**
 * services/fhir-ingestion/src/main.ts
 *
 * FHIR Ingestion Microservice — application entry point.
 *
 * Responsibilities:
 *   1. Bootstraps a NestJS application (Express platform) so the
 *      dependency-injection graph (FhirModule) is initialized.
 *   2. The FhirConsumerService connects to Kafka on `onModuleInit` and
 *      begins consuming `fhir.resource.ingested` events.
 *   3. For each bundle: validates (FhirValidationService), persists
 *      (FhirPersistenceService), and emits `fhir.resource.validated` +
 *      `audit.event` events.
 *   4. Graceful shutdown on SIGINT/SIGTERM — closes the Nest app, which
 *      triggers every `OnModuleDestroy` hook (including the Kafka
 *      consumer/producer disconnect) so partitions rebalance promptly.
 *
 * This service is independently deployable and scales horizontally by
 * adding more instances in the same Kafka consumer group
 * (`caregiver-fhir-ingestion`).
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, type INestApplication } from '@nestjs/common';
import { AppModule } from './app.module.js';

/** Semantic version of the fhir-ingestion microservice. */
export const FHIR_INGESTION_VERSION = '0.1.0';

/**
 * Bootstrap the NestJS application and start the Kafka consumer.
 *
 * Uses `NestFactory.create` (rather than `createApplicationContext`) so an
 * HTTP listener is available for a future health/readiness endpoint. The
 * listener port defaults to 3004 (the documented fhir-ingestion port).
 *
 * @returns The started INestApplication reference (used for graceful close).
 */
async function bootstrap(): Promise<INestApplication> {
  const logger = new Logger('Bootstrap');

  // Create the NestJS application with the Express platform.
  // `bufferLogs: true` defers log output until the Logger is ready.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(logger);

  // Global API prefix reserved for a future health endpoint.
  app.setGlobalPrefix('api');

  // Enable graceful shutdown — NestJS will call onModuleDestroy/onAppShutdown
  // hooks when `app.close()` is invoked (we do this on SIGINT/SIGTERM).
  app.enableShutdownHooks();

  // Start the HTTP listener (used for health checks / readiness probes).
  // The Kafka consumer starts automatically via FhirConsumerService.onModuleInit.
  const port = parseInt(process.env.FHIR_INGESTION_PORT ?? '3004', 10);
  await app.listen(port);

  logger.log(`Caregiver FHIR Ingestion service listening on http://localhost:${port}`);
  logger.log(`Version: ${FHIR_INGESTION_VERSION}`);

  return app;
}

// ── Start the service ────────────────────────────────────────────
// Capture the app reference so we can close it on shutdown signals.
let appRef: INestApplication | undefined;

bootstrap()
  .then((app) => {
    appRef = app;
  })
  .catch((err) => {
     
    console.error('[fhir-ingestion] Fatal error during bootstrap:', err);
    process.exit(1);
  });

/**
 * Graceful shutdown handler.
 *
 * Closes the NestJS app (which triggers every OnModuleDestroy hook —
 * including the Kafka consumer/producer disconnect). Errors are logged
 * but never re-thrown so the process always exits cleanly.
 */
async function gracefulExit(signal: string): Promise<void> {
  const logger = new Logger('Bootstrap');
  logger.log(`Received ${signal}; shutting down.`);
  try {
    if (appRef) {
      // app.close() runs OnModuleDestroy → FhirConsumerService disconnects
      // the Kafka consumer/producer so the consumer group rebalances.
      await appRef.close();
    }
  } catch (err) {
    logger.error(`Error during graceful shutdown: ${String(err)}`);
  } finally {
    process.exit(0);
  }
}

// Wire graceful shutdown on SIGINT (Ctrl-C) and SIGTERM (container stop).
process.on('SIGINT', () => void gracefulExit('SIGINT'));
process.on('SIGTERM', () => void gracefulExit('SIGTERM'));
