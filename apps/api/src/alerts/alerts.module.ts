/**
 * apps/api/src/alerts/alerts.module.ts
 *
 * Alerts module — the home of everything alert-related in the API gateway:
 *
 *   - AlertsController      → REST compliance endpoints (state reporting)
 *   - AlertQueryService     → read-only Drizzle queries for that API
 *   - AlertsGateway         → Socket.io gateway for real-time delivery
 *   - AlertConsumerService  → Kafka consumer feeding the gateway
 *
 * Previously the gateway + consumer lived directly in AppModule; grouping
 * them here keeps alert concerns in one feature module (repo convention),
 * while the query service joins them for the new compliance surface.
 */
import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller.js';
import { AlertQueryService } from './alert-query.service.js';
import { AlertsGateway } from './alerts.gateway.js';
import { AlertConsumerService } from './alert-consumer.service.js';

@Module({
  controllers: [AlertsController],
  providers: [AlertQueryService, AlertsGateway, AlertConsumerService],
})
export class AlertsModule {}
