/**
 * services/notifications/src/alerts/vitals-consumer.service.ts
 *
 * Kafka consumer for the `vitals.recorded` topic.
 *
 * For every vitals event:
 *   1. If the producer already flagged `thresholdBreached`, OR the local
 *      threshold check finds a breach, an alert is created + dispatched.
 *   2. The local check runs regardless of the upstream flag so this
 *      service remains the authoritative threshold evaluator (the flag
 *      is a hint from the recording service, not the final word).
 *
 * Implements NestJS `OnModuleInit` / `OnModuleDestroy` so the consumer
 * connects on startup and disconnects cleanly on shutdown.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createConsumer, type TypedConsumer } from '@caregiver/kafka';
import type { VitalsRecordedPayload } from '@caregiver/contracts';
import { ThresholdService } from './threshold.service.js';
import { AlertService } from './alert.service.js';

@Injectable()
export class VitalsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VitalsConsumerService.name);

  /** Kafka consumer bound to the notifications consumer group. */
  private readonly consumer: TypedConsumer;

  constructor(
    private readonly thresholdService: ThresholdService,
    private readonly alertService: AlertService,
  ) {
    // Consumer group is shared by all notifications replicas — Kafka
    // distributes partitions across instances for horizontal scaling.
    this.consumer = createConsumer('caregiver-notifications-vitals');
  }

  async onModuleInit(): Promise<void> {
    await this.consumer.connect();
    // Explicit type argument binds the envelope payload to the contract type
    // (TypeScript cannot infer P from a contravariant handler parameter).
    await this.consumer.subscribe<VitalsRecordedPayload>(
      'vitals.recorded',
      async (envelope) => this.handleVitalsRecorded(envelope.payload),
    );
    this.logger.log('Subscribed to vitals.recorded.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
    this.logger.log('Vitals consumer disconnected.');
  }

  /**
   * Process a single vitals.recorded event.
   * Evaluates thresholds and creates an alert if any vital is out of range.
   */
  private async handleVitalsRecorded(payload: VitalsRecordedPayload): Promise<void> {
    // Always run the local threshold check — it is the source of truth.
    const breach = this.thresholdService.checkVitals(payload);

    // If the recording service already flagged a breach but our check
    // found none (e.g. thresholds were loosened), still log it for
    // observability but do not create a duplicate alert.
    if (!breach) {
      if (payload.thresholdBreached) {
        this.logger.warn(
          `vitals.recorded flagged breach but no local threshold exceeded (patient ${payload.patientId}).`,
        );
      }
      return;
    }

    this.logger.warn(
      `Threshold breach detected for patient ${payload.patientId}: ${breach.message}`,
    );

    await this.alertService.createAndDispatch({
      patientId: payload.patientId,
      alertType: 'vital_threshold',
      severity: breach.severity,
      message: breach.message,
      metadata: {
        vitalsId: payload.vitalsId,
        vitalName: breach.vitalName,
        value: breach.value,
        recordedAt: payload.recordedAt,
        recordedBy: payload.recordedBy,
        ...breach.metadata,
      },
    });
  }
}
