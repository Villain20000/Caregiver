/**
 * services/audit/src/main.ts
 *
 * Audit Microservice (Append-Only Log) — application entry point.
 *
 * Responsibilities:
 *   1. Bootstraps a NestJS application (Express platform) for DI, logging,
 *      and structured lifecycle management.
 *   2. Starts the Kafka consumer on the `audit.event` topic via
 *      AuditConsumerService (triggered by OnApplicationBootstrap).
 *   3. Persists each consumed event as an immutable, append-only row in the
 *      `audit_log` Postgres table via Drizzle ORM.
 *   4. NEVER updates or deletes — the audit log is write-once-read-many.
 *      This is enforced at the DB level (no UPDATE/DELETE grants on the
 *      table for the audit service's DB role) and by the absence of any
 *      update/delete methods in the persistence layer.
 *
 * Audit events include:
 *   - Who (user ID + role)
 *   - What (action: create, read, update, delete, login, logout, ...)
 *   - When (timestamp with timezone)
 *   - Where (source IP, service name)
 *   - Which resource (FHIR resource type + ID)
 *   - Result (success/failure + reason)
 *
 * This service is critical for HIPAA compliance and regulatory reporting.
 *
 * Graceful shutdown:
 *   On SIGINT/SIGTERM the NestJS app is closed, which fires
 *   OnApplicationShutdown on the consumer → Kafka disconnect (offsets
 *   flushed, consumer leaves the group cleanly).
 */
// reflect-metadata must be imported before any NestJS decorator usage so
// that emitDecoratorMetadata metadata is available to the DI container.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';

/** Semantic version of the audit microservice. */
export const AUDIT_VERSION = '0.1.0';

/**
 * Bootstrap the audit microservice.
 *
 * Creates the NestJS application context (Express platform), which in turn
 * triggers OnApplicationBootstrap on AuditConsumerService to connect to
 * Kafka and subscribe to `audit.event`. Enables graceful shutdown hooks so
 * that SIGINT/SIGTERM cleanly disconnect the consumer.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Create the NestJS app. NestFactory.create defaults to the Express
  // platform (provided by @nestjs/platform-express). We use
  // createApplicationContext-style behavior implicitly: no HTTP listener is
  // started because we never call app.listen(). The app exists solely to
  // host the DI container and lifecycle hooks for the Kafka consumer.
  const app = await NestFactory.create(AppModule, {
    // Buffer logs until the Nest logger is ready (avoids losing early logs).
    bufferLogs: true,
  });

  // Enable graceful shutdown — NestJS listens for SIGINT/SIGTERM and runs
  // OnApplicationShutdown on all providers (disconnects the Kafka consumer).
  app.enableShutdownHooks();

  // Log a startup message so the service is discoverable in container logs.
  logger.log(`Caregiver Audit Microservice v${AUDIT_VERSION} starting...`);
  logger.log('Consuming Kafka topic: audit.event → audit_log (append-only)');

  // await app.init() is already invoked by NestFactory.create. We do NOT
  // call app.listen() — this service has no inbound HTTP surface. The
  // process stays alive because the Kafka consumer's run loop keeps the
  // event loop busy.
  logger.log('Audit microservice ready.');
}

// Start the microservice. `void` discards the promise — unhandled rejection
// would surface as a process crash, which is the desired fail-fast behavior
// for a compliance-critical service.
void bootstrap();
