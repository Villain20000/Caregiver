/**
 * apps/api/src/vitals/vitals.module.ts
 *
 * Vitals module — handles vital signs recording and retrieval.
 * Emits Kafka events when vitals are recorded (consumed by alerts service).
 */
import { Module } from '@nestjs/common';
import { VitalsController } from './vitals.controller.js';
import { VitalsService } from './vitals.service.js';

@Module({
  controllers: [VitalsController],
  providers: [VitalsService],
})
export class VitalsModule {}
