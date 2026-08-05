/**
 * apps/api/src/alerts/alert-consumer.service.ts
 *
 * Kafka consumer for the `alert.dispatched` topic — the missing link that
 * completes the real-time alert pipeline:
 *
 *   notifications service → Kafka (alert.dispatched) → THIS consumer
 *   → AlertsGateway.broadcastAlert() → Socket.io rooms → browser
 *
 * The AlertsGateway already had `broadcastAlert()` ready; this service is
 * what actually invokes it when a dispatched alert arrives, so the gateway
 * can fan the alert out to the `role:<role>` and `user:<patientId>` rooms.
 *
 * It also handles the SECOND dispatch kind produced by the escalation
 * sweeper (escalated: true) — escalations ride the same topic, so no extra
 * wiring is needed: the re-dispatched alert is simply broadcast again with
 * its widened target roles.
 *
 * Implements NestJS `OnModuleInit` / `OnModuleDestroy` so the consumer
 * connects on startup and disconnects cleanly on shutdown.
 *
 * Resilience: Kafka unavailability at boot is treated as NON-fatal. The API
 * gateway is the BFF — it also serves every REST endpoint — so a broker
 * outage must not prevent it from booting. If the initial connect (or a
 * retry) fails, we log and schedule a background reconnect instead of
 * crashing the process.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createConsumer, type TypedConsumer } from '@caregiver/kafka';
import type { AlertDispatchedPayload } from '@caregiver/contracts';
import { AlertsGateway } from './alerts.gateway.js';

/** Reconnect delay when Kafka is unreachable (30 s). */
export const CONNECT_RETRY_MS = 30_000;

@Injectable()
export class AlertConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertConsumerService.name);

  /** Handle for the background reconnect timer (cleared on shutdown). */
  private connectTimer: NodeJS.Timeout | null = null;

  /** True once the module has been torn down — stops late retries. */
  private destroyed = false;

  /**
   * Kafka consumer bound to the API gateway's own alert consumer group
   * (separate from the notifications service's groups — this is the
   * delivery half of the pipeline).
   */
  private readonly consumer: TypedConsumer;

  constructor(private readonly alertsGateway: AlertsGateway) {
    this.consumer = createConsumer('caregiver-api-alerts');
  }

  async onModuleInit(): Promise<void> {
    await this.tryConnect();
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    await this.consumer.disconnect();
    this.logger.log('Alert consumer disconnected.');
  }

  /**
   * Connect to Kafka and subscribe. On failure, log and schedule a
   * background retry so a broker outage never takes down the API gateway.
   */
  private async tryConnect(): Promise<void> {
    // If the module was destroyed while a retry was in flight (e.g. a
    // connect attempt that failed AFTER onModuleDestroy ran), stop here —
    // no scheduling a fresh timer post-shutdown.
    if (this.destroyed) return;

    try {
      await this.consumer.connect();
      // Explicit type argument binds the envelope payload to the contract
      // type (TypeScript cannot infer P from a contravariant handler parameter).
      await this.consumer.subscribe<AlertDispatchedPayload>('alert.dispatched', async (envelope) =>
        this.handleAlertDispatched(envelope.payload),
      );
      this.logger.log('Subscribed to alert.dispatched.');
    } catch (error) {
      if (this.destroyed) return;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to connect to Kafka: ${message}. Retrying in ${CONNECT_RETRY_MS}ms.`,
      );
      this.connectTimer = setTimeout(() => {
        void this.tryConnect();
      }, CONNECT_RETRY_MS);
      this.connectTimer.unref?.();
    }
  }

  /**
   * Forward a dispatched alert (initial or escalation) to the Socket.io
   * gateway for real-time delivery to the target role/user rooms.
   */
  private async handleAlertDispatched(payload: AlertDispatchedPayload): Promise<void> {
    this.alertsGateway.broadcastAlert(payload);
    this.logger.log(
      `Alert ${payload.alertId} forwarded to gateway${payload.escalated ? ' (escalation)' : ''}.`,
    );
  }
}
