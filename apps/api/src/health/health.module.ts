/**
 * apps/api/src/health/health.module.ts
 *
 * Health module — provides a simple health check endpoint.
 * Used by Docker/Kubernetes liveness probes and the frontend health indicator.
 */
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
