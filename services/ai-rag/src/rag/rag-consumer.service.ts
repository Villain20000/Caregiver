/**
 * services/ai-rag/src/rag/rag-consumer.service.ts
 *
 * Kafka consumer — the entry point of the AI/RAG microservice.
 *
 * Subscribes to the `ai.diagnosis.requested` topic and dispatches each
 * event to the RAG pipeline. Implements NestJS lifecycle hooks so the
 * consumer connects on module init and disconnects cleanly on shutdown.
 *
 * Consumer group: `caregiver-ai-rag`. All instances sharing this group ID
 * partition the topic for horizontal scaling (KafkaJS at-least-once).
 *
 * Error handling: the pipeline itself never throws (it captures failures
 * and marks the diagnosis `failed`), but if the handler does throw, the
 * underlying TypedConsumer will NOT commit the offset and the message will
 * be redelivered (at-least-once semantics).
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createConsumer, type TypedConsumer } from '@caregiver/kafka';
import type { AiDiagnosisRequestedPayload } from '@caregiver/contracts';
import { RagPipelineService } from './rag-pipeline.service.js';

/**
 * Kafka consumer group ID. Instances with the same group ID share topic
 * partitions (horizontal scaling + at-least-once delivery).
 */
const CONSUMER_GROUP_ID = 'caregiver-ai-rag';

/**
 * Kafka consumer service — bridges `ai.diagnosis.requested` events to the
 * RAG pipeline.
 */
@Injectable()
export class RagConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('RagConsumer');

  /** Underlying typed Kafka consumer (created on init). */
  private consumer: TypedConsumer | null = null;

  constructor(private readonly pipeline: RagPipelineService) {}

  /**
   * Connect to Kafka and subscribe to `ai.diagnosis.requested`.
   * Runs on application startup.
   */
  async onModuleInit(): Promise<void> {
    this.consumer = createConsumer(CONSUMER_GROUP_ID);

    await this.consumer.connect();
    this.logger.log(`Kafka consumer connected (group=${CONSUMER_GROUP_ID}).`);

    // Subscribe to the diagnosis-requested topic. Each message is dispatched
    // to the RAG pipeline with the envelope metadata forwarded for tracing.
    await this.consumer.subscribe<AiDiagnosisRequestedPayload>(
      'ai.diagnosis.requested',
      async (envelope) => {
        this.logger.log(
          `Received diagnosis request ${envelope.payload.diagnosisId} (event ${envelope.eventId}).`,
        );

        await this.pipeline.run(envelope.payload, {
          userId: envelope.userId,
          userRole: envelope.userRole,
          correlationId: envelope.correlationId,
        });
      },
    );

    this.logger.log('Subscribed to ai.diagnosis.requested — awaiting messages.');
  }

  /**
   * Disconnect from Kafka on graceful shutdown so offsets are committed
   * and the consumer leaves the group cleanly (triggers rebalance).
   */
  async onModuleDestroy(): Promise<void> {
    if (this.consumer) {
      this.logger.log('Kafka consumer disconnecting...');
      await this.consumer.disconnect();
      this.consumer = null;
    }
  }
}
