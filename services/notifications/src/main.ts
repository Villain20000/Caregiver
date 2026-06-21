/**
 * services/notifications/src/main.ts
 *
 * Notifications Microservice — application entry point.
 *
 * This is the real-time alert engine of the Caregiver platform. It is a
 * headless NestJS application: it has no inbound HTTP surface. Instead it
 * is purely event-driven:
 *
 *   1. Consumes `vitals.recorded`, `appointment.created`, and
 *      `appointment.updated` events from Kafka.
 *   2. Evaluates clinical thresholds (vitals) or generates reminders
 *      (appointments).
 *   3. Persists alerts to the Postgres `alerts` table via Drizzle ORM.
 *   4. Emits `alert.dispatched` Kafka events — the API gateway consumes
 *      these and fans them out to connected Angular clients over Socket.io.
 *   5. Mirrors every alert creation to `audit.event` for compliance.
 *
 * Bootstrap flow:
 *   - `import 'reflect-metadata'` must run before NestJS DI (decorator
 *     metadata is read via reflect-metadata).
 *   - `app.init()` (not `app.listen()`) boots the DI container and runs
 *     `OnModuleInit` hooks, which connect the Kafka consumers. No port is
 *     bound because there is no HTTP server.
 *   - `enableShutdownHooks()` lets NestJS react to SIGTERM/SIGINT and run
 *     `OnModuleDestroy` hooks (Kafka disconnects) for graceful shutdown.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';

/** Semantic version of the notifications microservice. */
export const NOTIFICATIONS_VERSION = '0.1.0';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Notifications');

  // Create the NestJS application instance (Express platform under the hood,
  // though we never bind a listening port — this service is event-driven).
  const app = await NestFactory.create(AppModule, {
    // No HTTP surface; silence the default Express setup noise.
    bodyParser: false,
  });

  // Let NestJS handle SIGTERM/SIGINT → OnModuleDestroy (Kafka disconnects).
  app.enableShutdownHooks();

  // Initialize the DI container + run OnModuleInit hooks (Kafka consumers
  // connect here). We deliberately do NOT call app.listen() — there is no
  // inbound HTTP port. The process stays alive via the Kafka consumer
  // connections holding the event loop open.
  await app.init();

  logger.log(`Notifications microservice v${NOTIFICATIONS_VERSION} ready (event-driven, no HTTP port).`);
}

// Start the microservice. void — top-level await is available but we keep
// the bootstrap call explicit so the unhandled rejection surfaces clearly.
void bootstrap().catch((error) => {
   
  console.error('[notifications] Fatal error during bootstrap:', error);
  process.exit(1);
});
