/**
 * services/fhir-ingestion/src/fhir/fhir-consumer.service.ts
 *
 * Kafka consumer orchestration for the FHIR ingestion pipeline.
 *
 * Subscribes to the `fhir.resource.ingested` topic (produced by the API
 * gateway when external systems POST FHIR bundles). For each message:
 *
 *   1. Extracts the FHIR Bundle from the `FhirResourceIngestedPayload`.
 *   2. Validates every entry via `FhirValidationService`.
 *   3. Persists every entry via `FhirPersistenceService` (upsert on fhirId).
 *   4. Emits a `fhir.resource.validated` event per entry (valid or not) so
 *      downstream services (ai-rag, notifications) can react.
 *   5. Emits an `audit.event` per validation action (success or failure)
 *      for the audit microservice's append-only log.
 *
 * The consumer runs in the `caregiver-fhir-ingestion` consumer group, so
 * multiple instances scale horizontally (Kafka partitions the topic).
 *
 * Lifecycle: `onModuleInit` connects the consumer+producer and starts
 * consumption; `onModuleDestroy` disconnects them for graceful shutdown.
 */
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  createConsumer,
  createProducer,
  type TypedConsumer,
  type TypedProducer,
  type KafkaEnvelope,
} from '@caregiver/kafka';
import type {
  FhirResourceIngestedPayload,
  FhirResourceValidatedPayload,
  AuditEventPayload,
} from '@caregiver/contracts';
import { FhirValidationService, type FhirValidationResult } from './fhir-validation.service.js';
import { FhirPersistenceService } from './fhir-persistence.service.js';

/**
 * Injection token for the Kafka consumer group id.
 *
 * Overridable in tests; defaults to the production consumer group.
 */
export const FHIR_CONSUMER_GROUP_ID = 'FHIR_CONSUMER_GROUP_ID';

/** Default consumer group — shared by all fhir-ingestion instances. */
const DEFAULT_CONSUMER_GROUP = 'caregiver-fhir-ingestion';

/** Source identifier embedded in every event this service produces. */
const SERVICE_SOURCE = 'fhir-ingestion';

/**
 * FhirConsumerService — the Kafka-facing orchestrator.
 *
 * Depends on:
 *   - FhirValidationService   (structural validation)
 *   - FhirPersistenceService  (Drizzle upserts)
 *   - TypedConsumer / TypedProducer (created internally from @caregiver/kafka)
 */
@Injectable()
export class FhirConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('FhirConsumerService');

  // The consumer/producer are created lazily in onModuleInit so the service
  // can be instantiated in tests without a live Kafka cluster.
  private consumer: TypedConsumer;
  private producer: TypedProducer;

  constructor(
    private readonly validation: FhirValidationService,
    private readonly persistence: FhirPersistenceService,
    @Inject(FHIR_CONSUMER_GROUP_ID) private readonly groupId: string = DEFAULT_CONSUMER_GROUP,
  ) {
    // Instantiate the Kafka client wrappers up front (no network I/O yet —
    // connect() happens in onModuleInit).
    this.consumer = createConsumer(this.groupId);
    this.producer = createProducer(SERVICE_SOURCE);
  }

  /**
   * Connect to Kafka and begin consuming `fhir.resource.ingested`.
   *
   * Runs once on application startup. If the connection fails the NestJS
   * bootstrap will fail fast (preferred over a silently broken consumer).
   */
  async onModuleInit(): Promise<void> {
    await this.producer.connect();
    this.logger.log('Kafka producer connected.');

    await this.consumer.connect();
    this.logger.log(`Kafka consumer connected (group: ${this.groupId}).`);

    // Subscribe to the ingested-resources topic. The handler does the
    // validate → persist → emit dance for each incoming bundle.
    await this.consumer.subscribe<FhirResourceIngestedPayload>(
      'fhir.resource.ingested',
      (envelope) => this.handleIngested(envelope),
    );
    this.logger.log('Subscribed to fhir.resource.ingested.');
  }

  /**
   * Disconnect from Kafka on shutdown so partitions rebalance promptly.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Kafka consumer/producer...');
    try {
      await this.consumer.disconnect();
    } catch (err) {
      this.logger.error('Error disconnecting consumer', String(err));
    }
    try {
      await this.producer.disconnect();
    } catch (err) {
      this.logger.error('Error disconnecting producer', String(err));
    }
  }

  /**
   * Process a single `fhir.resource.ingested` envelope.
   *
   * Validates and persists every resource in the bundle, then emits one
   * `fhir.resource.validated` event and one `audit.event` per resource.
   * Errors during persistence are caught per-resource so one bad row does
   * not abort the rest of the bundle (at-least-once with partial success).
   *
   * @param envelope - The typed Kafka envelope wrapping the payload.
   */
  private async handleIngested(
    envelope: KafkaEnvelope<FhirResourceIngestedPayload>,
  ): Promise<void> {
    const { payload, correlationId, userId, userRole } = envelope;
    const occurredAt = new Date().toISOString();

    this.logger.log(
      `Received bundle from '${payload.sourceSystem}' (correlationId=${correlationId ?? 'n/a'}).`,
    );

    // ── Validate every entry in the bundle ─────────────────────
    const results = this.validation.validateBundle(payload.bundle);

    if (results.length === 0) {
      // Empty bundle — still emit an audit event so the gap is visible.
      await this.emitAudit({
        action: 'validate',
        result: 'failure',
        errorMessage: 'Bundle contained no entries',
        userId,
        userRole,
        occurredAt,
        correlationId,
        details: { sourceSystem: payload.sourceSystem },
      });
      return;
    }

    // ── Persist + emit per resource ────────────────────────────
    for (const result of results) {
      await this.processSingleResult(result, {
        userId,
        userRole,
        occurredAt,
        correlationId,
        sourceSystem: payload.sourceSystem,
      });
    }
  }

  /**
   * Persist a single validation result and emit its downstream events.
   *
   * Persistence failures are captured and reflected in the emitted events
   * rather than thrown, so a single bad row does not abort the bundle.
   */
  private async processSingleResult(
    result: FhirValidationResult,
    ctx: {
      userId?: string;
      userRole?: string;
      occurredAt: string;
      correlationId?: string;
      sourceSystem: string;
    },
  ): Promise<void> {
    // Skip persistence for entries that had no resource at all (synthetic
    // failure produced by validateBundle). Still emit audit + validated
    // events so the malformed entry is tracked end-to-end.
    let dbId: string | undefined;
    let persistenceError: string | undefined;

    if (result.fhirId) {
      try {
        const persisted = await this.persistence.upsertResource(result);
        dbId = persisted.id;
      } catch (err) {
        persistenceError = `Persistence failed: ${String(err)}`;
        this.logger.error(
          `Persistence failed for ${result.resourceType}/${result.fhirId}: ${String(err)}`,
        );
      }
    }

    // ── Emit fhir.resource.validated ───────────────────────────
    // `valid` is false if either validation OR persistence failed.
    const valid = result.valid && !persistenceError;
    const errors = persistenceError ? [...result.errors, persistenceError] : result.errors;

    const validatedPayload: FhirResourceValidatedPayload = {
      resourceType: result.resourceType,
      fhirId: result.fhirId,
      resource: result.resource,
      valid,
      errors: errors.length > 0 ? errors : undefined,
      dbId,
    };

    await this.producer.send<FhirResourceValidatedPayload>(
      'fhir.resource.validated',
      validatedPayload,
      { correlationId: ctx.correlationId, userId: ctx.userId, userRole: ctx.userRole },
    );

    // ── Emit audit.event (one per validation action) ───────────
    await this.emitAudit({
      action: 'validate',
      result: valid ? 'success' : 'failure',
      resourceType: result.resourceType || undefined,
      resourceId: result.fhirId || dbId,
      errorMessage: valid ? undefined : errors.join('; ') || undefined,
      userId: ctx.userId,
      userRole: ctx.userRole,
      occurredAt: ctx.occurredAt,
      correlationId: ctx.correlationId,
      details: {
        sourceSystem: ctx.sourceSystem,
        dbId,
        validationStatus: valid ? 'validated' : 'invalid',
      },
    });
  }

  /**
   * Helper: emit an `audit.event` with the standard envelope metadata.
   */
  private async emitAudit(audit: {
    action: AuditEventPayload['action'];
    result: AuditEventPayload['result'];
    resourceType?: string;
    resourceId?: string;
    errorMessage?: string;
    userId?: string;
    userRole?: string;
    occurredAt: string;
    correlationId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const payload: AuditEventPayload = {
      action: audit.action,
      result: audit.result,
      resourceType: audit.resourceType,
      resourceId: audit.resourceId,
      errorMessage: audit.errorMessage,
      userId: audit.userId,
      userRole: audit.userRole,
      serviceName: SERVICE_SOURCE,
      details: audit.details,
      occurredAt: audit.occurredAt,
    };

    await this.producer.send<AuditEventPayload>('audit.event', payload, {
      correlationId: audit.correlationId,
      userId: audit.userId,
      userRole: audit.userRole,
    });
  }
}
