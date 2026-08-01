/**
 * apps/api/src/orders/orders.module.ts
 *
 * Orders module — manages clinical orders (lab, imaging, medication).
 *
 * 📝 NestJS Concepts Demonstrated:
 *   - Feature module organization pattern
 *   - Controller + Service pair separated by concern
 *   - Dependencies injected via constructor (@Inject(KAFKA_PRODUCER))
 */
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
