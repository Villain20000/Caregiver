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
 *   - AlertsModule    → alert compliance API + Socket.io gateway + Kafka
 *                       consumer (alert.dispatched → gateway broadcast)
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
import { AlertsModule } from './alerts/alerts.module.js';
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
    // AlertsModule — REST compliance endpoints + Socket.io gateway + the
    // Kafka consumer that forwards alert.dispatched (incl. escalations).
    AlertsModule,
  ],
})
export class AppModule {}
