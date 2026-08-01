/**
 * apps/api/src/billing/billing.module.ts
 *
 * Billing module — handles insurance claims and payments.
 *
 * 📝 NestJS Concepts Demonstrated:
 *   - **@Module()** with controller + provider registration
 *   - Controllers receive route prefix from @Controller('billing')
 *   - BillingService uses @Inject(KAFKA_PRODUCER) for event emission
 */
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';

@Module({
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
