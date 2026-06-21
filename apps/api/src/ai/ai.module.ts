/**
 * apps/api/src/ai/ai.module.ts
 *
 * AI module — handles AI-assisted diagnosis requests and reviews.
 * Emits Kafka events consumed by the ai-rag microservice.
 */
import { Module } from '@nestjs/common';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';

@Module({
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
