/**
 * services/notifications/src/app.module.ts
 *
 * Root NestJS module for the notifications microservice.
 *
 * This is a single-purpose service (the real-time alert engine), so the
 * module tree is intentionally flat: the `NotificationsModule` owns all
 * alert-related providers, Kafka consumers, and the DB/producer wiring.
 *
 * No REST controllers are registered — this service has no inbound HTTP
 * surface. It is purely event-driven (Kafka in → alert persistence +
 * Kafka out).
 */
import { Module } from '@nestjs/common';
import { NotificationsModule } from './alerts/notifications.module.js';

@Module({
  imports: [NotificationsModule],
})
export class AppModule {}
