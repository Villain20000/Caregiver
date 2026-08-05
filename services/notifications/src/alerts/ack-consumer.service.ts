/**
 * services/notifications/src/alerts/ack-consumer.service.ts
 *
 * Kafka consumer for the `alert.acknowledged` topic — the persistence half
 * of the acknowledgment flow.
 *
 * When a user dismisses an alert in the browser, the API gateway's
 * Socket.io handler does NOT touch the database (BFF pattern). Instead it
 * emits `alert.acknowledged`; this consumer receives it and:
 *
 *   1. Persists acknowledged = true, acknowledgedBy, acknowledgedAt on the
 *      alert row (via Drizzle).
 *   2. Mirrors the acknowledgment to `audit.event` for the compliance
 *      trail — consistent with AlertService (creation) and
 *      EscalationService (escalation).
 *
 * This keeps ALL alert writes in the notifications service: creation,
 * escalation, and now acknowledgment.
 *
 * Implements NestJS `OnModuleInit` / `OnModuleDestroy` so the consumer
 * connects on startup and disconnects cleanly on shutdown.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createConsumer, type TypedConsumer, type TypedProducer } from '@caregiver/kafka';
import { schema, type Database } from '@caregiver/db';
import type { AlertAcknowledgedPayload, AuditEventPayload } from '@caregiver/contracts';
import { DATABASE, KAFKA_PRODUCER } from './alert.service.js';

@Injectable()
export class AckConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AckConsumerService.name);

  /** Kafka consumer bound to the notifications ack consumer group. */
  private readonly consumer: TypedConsumer;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(KAFKA_PRODUCER) private readonly producer: TypedProducer,
  ) {
    this.consumer = createConsumer('caregiver-notifications-acks');
  }

  async onModuleInit(): Promise<void> {
    await this.consumer.connect();
    // Explicit type argument binds the envelope payload to the contract
    // type (TypeScript cannot infer P from a contravariant handler parameter).
    await this.consumer.subscribe<AlertAcknowledgedPayload>(
      'alert.acknowledged',
      async (envelope) => this.handleAcknowledged(envelope.payload),
    );
    this.logger.log('Subscribed to alert.acknowledged.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
    this.logger.log('Ack consumer disconnected.');
  }

  /**
   * Persist an acknowledgment and mirror it to the audit trail.
   *
   * @param payload - alertId + who acknowledged + when.
   */
  private async handleAcknowledged(payload: AlertAcknowledgedPayload): Promise<void> {
    const { alertId, acknowledgedBy, acknowledgedAt } = payload;

    // Persist the ack state on the alert row. returning() guards against
    // a false-success audit entry: if the alert doesn't exist (0 rows
    // updated), we skip the audit mirror and log instead.
    const updated = await this.db
      .update(schema.alerts)
      .set({
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt: new Date(acknowledgedAt),
      })
      .where(eq(schema.alerts.id, alertId))
      .returning();

    if (!updated || updated.length === 0) {
      this.logger.warn(`Acknowledge: alert ${alertId} not found — skipping audit mirror.`);
      return;
    }

    this.logger.log(`Alert ${alertId} acknowledged by ${acknowledgedBy} at ${acknowledgedAt}.`);

    // Mirror to the compliance audit trail.
    const auditPayload: AuditEventPayload = {
      action: 'update',
      resourceType: 'alerts',
      resourceId: alertId,
      result: 'success',
      serviceName: 'notifications',
      details: {
        acknowledged: true,
        acknowledgedBy,
        acknowledgedAt,
      },
      occurredAt: acknowledgedAt,
    };
    await this.producer.send('audit.event', auditPayload, {
      correlationId: alertId,
    });
  }
}
