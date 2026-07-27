/**
 * apps/api/src/app.module.ts
 *
 * Root NestJS module — wires together all feature modules.
 *
 * Module structure:
 *   - AuthModule      → login, refresh, JWT strategy
 *   - HealthModule    → health check endpoint
 *   - AppointmentModule → appointment CRUD (emits Kafka events)
 *   - VitalsModule    → vitals recording (emits Kafka events)
 *   - AiModule        → AI diagnosis request/review (emits Kafka events)
 *   - AlertsGateway   → Socket.io gateway for real-time alerts
 *   - KafkaModule     → Kafka producer (global provider)
 */
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { AppointmentModule } from './appointments/appointment.module.js';
import { VitalsModule } from './vitals/vitals.module.js';
import { AiModule } from './ai/ai.module.js';
import { AuditModule } from './audit/audit.module.js';
import { FhirModule } from './fhir/fhir.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { BillingModule } from './billing/billing.module.js';
import { AlertsGateway } from './alerts/alerts.gateway.js';
import { KafkaModule } from './kafka/kafka.module.js';

@Module({
  // Feature modules — each encapsulates its own controllers/providers.
  imports: [
    KafkaModule, // Global — provides KafkaProducer to all modules.
    AuthModule,
    HealthModule,
    AppointmentModule,
    VitalsModule,
    AiModule,
    AuditModule,
    FhirModule,
    OrdersModule,
    BillingModule,
  ],
  // WebSocket gateway — real-time alert delivery via Socket.io.
  providers: [AlertsGateway],
})
export class AppModule {}
