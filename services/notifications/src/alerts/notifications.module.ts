/**
 * services/notifications/src/alerts/notifications.module.ts
 *
 * Root feature module for the notifications microservice.
 *
 * Wires together:
 *   - The Drizzle database instance (provided as `DATABASE` token).
 *   - The typed Kafka producer (provided as `KAFKA_PRODUCER` token),
 *     connected on init and disconnected on destroy.
 *   - The threshold evaluator, alert creator/dispatcher, the escalation
 *     sweeper, the ack persistence consumer, and the two Kafka consumers
 *     (vitals + appointments).
 *
 * The consumers self-manage their Kafka connections via NestJS lifecycle
 * hooks (OnModuleInit / OnModuleDestroy), so this module only needs to
 * supply the shared infrastructure (DB + producer) and the services.
 */
import { Module, OnModuleDestroy, Logger } from '@nestjs/common';
import { createDb, type Database } from '@caregiver/db';
import { createProducer, type TypedProducer } from '@caregiver/kafka';
import { ThresholdService } from './threshold.service.js';
import { AlertService, DATABASE, KAFKA_PRODUCER } from './alert.service.js';
import { EscalationService } from './escalation.service.js';
import { AckConsumerService } from './ack-consumer.service.js';
import { VitalsConsumerService } from './vitals-consumer.service.js';
import { AppointmentConsumerService } from './appointment-consumer.service.js';

/**
 * Factory for the Drizzle database instance.
 * `createDb` reads DATABASE_URL / POSTGRES_* env vars and returns a
 * lazily-connected client (no connection is opened until the first query).
 */
function databaseFactory(): Database {
  return createDb();
}

/**
 * Factory for the typed Kafka producer.
 * Connects immediately so the first `send` does not block on handshake.
 */
async function kafkaProducerFactory(): Promise<TypedProducer> {
  const producer = createProducer('notifications');
  await producer.connect();
  return producer;
}

@Module({
  providers: [
    // ── Infrastructure providers (injection tokens) ───────────
    { provide: DATABASE, useFactory: databaseFactory },
    {
      provide: KAFKA_PRODUCER,
      useFactory: kafkaProducerFactory,
    },
    // ── Domain services ───────────────────────────────────────
    ThresholdService,
    AlertService,
    // EscalationService self-starts its poll timer via OnModuleInit; it
    // escalates unacknowledged critical/emergency alerts after the timeout.
    EscalationService,
    // AckConsumerService persists alert acknowledgments emitted by the API
    // gateway (which never writes the DB directly — BFF pattern).
    AckConsumerService,
    VitalsConsumerService,
    AppointmentConsumerService,
  ],
  // AlertService + consumers are not exported — this is the only module
  // in the service and nothing else consumes them.
})
export class NotificationsModule implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsModule.name);

  // The producer is disconnected here (rather than via a separate lifecycle
  // hook on the factory result) because NestJS does not invoke lifecycle
  // hooks on factory-created providers. We resolve it from the container
  // at shutdown time.
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Notifications module shutting down...');
    // Producer disconnect is handled by the process-level graceful
    // shutdown in main.ts (which closes the full NestJS application).
  }
}
