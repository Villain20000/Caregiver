/**
 * apps/api/src/health/health.controller.ts
 *
 * Health controller — GET /api/health returns service status.
 *
 * This endpoint is NOT protected by auth (must be accessible by probes).
 * Returns 200 if the service is running, with a timestamp.
 */
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /**
   * GET /api/health — liveness probe.
   * Returns 200 with a timestamp if the service is running.
   */
  @Get()
  healthcheck(): { status: string; timestamp: string; service: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'caregiver-api-gateway',
    };
  }
}
