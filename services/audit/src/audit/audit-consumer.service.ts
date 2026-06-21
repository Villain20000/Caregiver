/**
 * services/audit/src/audit/audit-consumer.service.ts
 *
 * Kafka consumer for the `audit.event` topic.
 *
 * This service is the SOLE consumer of the `audit.event` topic. It uses a
 * dedicated consumer group (`caregiver-audit`) so that it receives every
 * audit event published by any service in the platform — regardless of how
 * many other consumer groups exist on the topic.
 *
 * Flow:
 *   Kafka (audit.event) → TypedConsumer → AuditConsumerService.handle()
 *     → AuditPersistenceService.persist() → audit_log INSERT
 *
 * Reliability guarantees:
 *   - At-least-once delivery: if `handle` throws, the message is NOT
 *     committed and Kafka redelivers it. The TypedConsumer wrapper re-throws
 *     so KafkaJS pauses the partition until retry.
 *   - Transient DB failures (connection blips) are retried locally with
 *     exponential backoff (1s, 2s, 4s) before re-throwing, to avoid
 *     needlessly re-driving the whole partition through Kafka retry.
 *   - Audit events must NEVER be silently lost. On unrecoverable failure the
 *     error is logged at `error` level (which feeds the platform's alerting)
 *     and re-thrown so the offset is not committed.
 *
 * Lifecycle:
 *   - On application bootstrap → connect + subscribe.
 *   - On application shutdown   → disconnect (graceful).
 */
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { createConsumer, type TypedConsumer, type KafkaEnvelope } from '@caregiver/kafka';
import type { AuditEventPayload } from '@caregiver/contracts';
import { AuditPersistenceService } from './audit-persistence.service.js';

/**
 * Dedicated consumer group for the audit service. Because no other service
 * subscribes to `audit.event`, this group receives 100% of the topic's
 * partitions. Multiple audit-service replicas sharing this group split the
 * partitions for horizontal throughput.
 */
const AUDIT_CONSUMER_GROUP = 'caregiver-audit';

/**
 * Retry configuration for transient DB failures.
 * 3 attempts with exponential backoff: 1s → 2s → 4s.
 */
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

/** Helper: sleep for `ms` milliseconds (used for backoff between retries). */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Kafka consumer + persistence orchestrator for audit events.
 *
 * Wires the typed Kafka consumer to the append-only persistence service and
 * manages the consumer's connection lifecycle via NestJS bootstrap/shutdown
 * hooks.
 */
@Injectable()
export class AuditConsumerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('AuditConsumerService');
  private readonly consumer: TypedConsumer;

  constructor(private readonly persistence: AuditPersistenceService) {
    // Create (but do not yet connect) the typed consumer. Connection is
    // deferred to OnApplicationBootstrap so DI has fully resolved first.
    this.consumer = createConsumer(AUDIT_CONSUMER_GROUP);
  }

  /**
   * Connect to Kafka and begin consuming `audit.event` once the NestJS
   * application has fully bootstrapped.
   */
  async onApplicationBootstrap(): Promise<void> {
    await this.consumer.connect();
    this.logger.log(`Kafka consumer connected (group: ${AUDIT_CONSUMER_GROUP}).`);

    // Subscribe to the sole topic this service consumes. The literal
    // 'audit.event' is validated against the KafkaTopic union at compile
    // time (it must appear in KAFKA_TOPICS), so this stays in sync with the
    // canonical topic registry. The handler is bound as an arrow closure so
    // `this` refers to the service instance.
    await this.consumer.subscribe<AuditEventPayload>(
      'audit.event',
      (envelope) => this.handle(envelope),
    );

    this.logger.log(`Subscribed to 'audit.event' — consuming audit events.`);
  }

  /**
   * Disconnect from Kafka on graceful shutdown so offsets are flushed and
   * the consumer leaves the group cleanly (triggers a rebalance).
   */
  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Disconnecting Kafka consumer...');
    await this.consumer.disconnect();
    this.logger.log('Kafka consumer disconnected.');
  }

  /**
   * Process a single audit-event envelope.
   *
   * Wraps `persist` in retry-with-exponential-backoff for transient DB
   * failures. If all retries are exhausted, the error is re-thrown so the
   * TypedConsumer does not commit the offset — Kafka will redeliver the
   * message, preserving the at-least-once guarantee. Audit events must not
   * be lost.
   *
   * @param envelope - The Kafka envelope wrapping an AuditEventPayload.
   */
  private async handle(envelope: KafkaEnvelope<AuditEventPayload>): Promise<void> {
    const { payload, eventId } = envelope;
    this.logger.debug(
      `Received audit event eventId=${eventId} action=${payload.action} service=${payload.serviceName}`,
    );

    let lastError: unknown;

    // Retry loop: 3 attempts with exponential backoff (1s, 2s, 4s).
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.persistence.persist(payload);
        return; // Success — return so the consumer commits the offset.
      } catch (error) {
        lastError = error;
        // Log each failed attempt with enough context to trace in Kibana.
        this.logger.error(
          `Failed to persist audit event (attempt ${attempt}/${MAX_RETRIES}) eventId=${eventId}: ${this.formatError(error)}`,
        );

        // If this wasn't the final attempt, back off before retrying.
        if (attempt < MAX_RETRIES) {
          const backoffMs = BASE_BACKOFF_MS * 2 ** (attempt - 1); // 1s, 2s, 4s
          this.logger.warn(`Retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
        }
      }
    }

    // All retries exhausted — log loudly (this feeds the alerting pipeline)
    // and re-throw so Kafka does NOT commit the offset. The message will be
    // redelivered, preserving the no-loss guarantee for audit events.
    this.logger.error(
      `Exhausted ${MAX_RETRIES} retries for audit event eventId=${eventId} — re-throwing to prevent offset commit.`,
    );
    throw lastError;
  }

  /**
   * Normalize an unknown error into a single loggable string. Avoids
   * printing `[object Object]` for non-Error throws.
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
