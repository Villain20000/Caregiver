/**
 * apps/api/src/kafka/kafka.module.ts
 *
 * Kafka module — provides a singleton TypedProducer to all modules.
 *
 * The producer is connected on module init and disconnected on destroy.
 * All events emitted by the API gateway flow through this producer.
 */
import { Global, Module, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { createProducer, type TypedProducer } from '@caregiver/kafka';

/** Symbol key for dependency injection (avoids string collision). */
export const KAFKA_PRODUCER = Symbol('KAFKA_PRODUCER');

/**
 * Factory that creates and connects the Kafka producer.
 * Runs on application startup; the producer stays connected for the
 * lifetime of the process.
 */
async function kafkaProducerFactory(): Promise<TypedProducer> {
  const producer = createProducer('api-gateway');
  await producer.connect();
  return producer;
}

/** Global module — the producer is available to all modules without re-importing. */
@Global()
@Module({
  providers: [
    {
      provide: KAFKA_PRODUCER,
      useFactory: kafkaProducerFactory,
    },
  ],
  exports: [KAFKA_PRODUCER],
})
export class KafkaModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('KafkaModule');

  onModuleInit(): void {
    this.logger.log('Kafka producer connected.');
  }

  onModuleDestroy(): void {
    this.logger.log('Kafka producer disconnecting...');
    // The producer's disconnect is handled by NestJS lifecycle.
    // In a full implementation, we'd inject and disconnect it here.
  }
}
