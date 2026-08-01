/**
 * apps/api/src/orders/orders.service.ts
 *
 * Orders service — business logic for creating, filling, and dispensing orders.
 *
 * 📝 NestJS Concepts Demonstrated:
 *   - **Singleton service** with @Injectable()
 *   - **Kafka event emission** at each state change
 *   - **Union types** for polymorphic order request DTOs
 *   - **Drizzle ORM** pattern: insert → returning() for DB interaction
 *
 * Handles three order types:
 *   - Lab orders (ServiceRequest in FHIR terms)
 *   - Imaging orders (ServiceRequest)
 *   - Medication orders (MedicationRequest in FHIR terms)
 *
 * Each state change emits a Kafka event for the audit trail.
 */
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, desc } from 'drizzle-orm';
import { createDb, schema, type Database } from '@caregiver/db';
import { KAFKA_PRODUCER } from '../kafka/kafka.module.js';
import type { TypedProducer } from '@caregiver/kafka';
import type {
  CreateLabOrderRequest,
  CreateImagingOrderRequest,
  CreateMedicationOrderRequest,
  FillOrderRequest,
  DispenseOrderRequest,
  OrderResponse,
  OrderCreatedPayload,
  OrderFilledPayload,
  OrderDispensedPayload,
} from '@caregiver/contracts';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger('OrdersService');
  private readonly db: Database;

  constructor(@Inject(KAFKA_PRODUCER) private readonly producer: TypedProducer) {
    this.db = createDb();
  }

  async createOrder(
    req: CreateLabOrderRequest | CreateImagingOrderRequest | CreateMedicationOrderRequest,
    requestedBy: string,
    requestedByRole: string,
  ): Promise<OrderResponse> {
    const [order] = await this.db
      .insert(schema.orders)
      .values({
        patientId: req.patientId,
        practitionerId: req.practitionerId,
        orderType: req.orderType,
        status: 'active',
        code: 'code' in req ? req.code : 'medicationCode' in req ? req.medicationCode : '',
        display:
          'display' in req ? req.display : 'medicationDisplay' in req ? req.medicationDisplay : '',
        reason: req.reason ?? null,
        notes: req.notes ?? null,
        priority: req.priority ?? 'routine',
      })
      .returning();

    if (!order) throw new Error('Failed to create order');

    const payload: OrderCreatedPayload = {
      orderId: order.id,
      patientId: order.patientId!,
      practitionerId: order.practitionerId!,
      orderType: order.orderType as 'lab' | 'imaging' | 'medication',
      code: order.code,
      display: order.display,
      reason: order.reason ?? undefined,
      priority: order.priority,
    };

    await this.producer.send('order.created', payload, {
      userId: requestedBy,
      userRole: requestedByRole,
    });

    this.logger.log(`Order ${order.id} (${req.orderType}) created by ${requestedBy}`);

    return this.toResponse(order);
  }

  async fillOrder(
    id: string,
    req: FillOrderRequest,
    filledBy: string,
    filledByRole: string,
  ): Promise<OrderResponse> {
    const [current] = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, id))
      .limit(1);

    if (!current) throw new NotFoundException(`Order ${id} not found`);

    const [updated] = await this.db
      .update(schema.orders)
      .set({
        status: 'completed',
        filledBy: req.pharmacistId || filledBy,
        notes: req.notes ?? current.notes,
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, id))
      .returning();

    if (!updated) throw new Error('Failed to fill order');

    const payload: OrderFilledPayload = {
      orderId: id,
      filledBy: req.pharmacistId || filledBy,
      notes: req.notes,
    };

    await this.producer.send('order.filled', payload, {
      userId: filledBy,
      userRole: filledByRole,
    });

    this.logger.log(`Order ${id} filled by ${filledBy}`);

    return this.toResponse(updated);
  }

  async dispenseOrder(
    id: string,
    req: DispenseOrderRequest,
    dispensedBy: string,
    dispensedByRole: string,
  ): Promise<OrderResponse> {
    const [current] = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, id))
      .limit(1);

    if (!current) throw new NotFoundException(`Order ${id} not found`);

    const [updated] = await this.db
      .update(schema.orders)
      .set({
        status: 'completed',
        dispensedBy: req.pharmacistId || dispensedBy,
        notes: req.notes ?? current.notes,
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, id))
      .returning();

    if (!updated) throw new Error('Failed to dispense order');

    const payload: OrderDispensedPayload = {
      orderId: id,
      dispensedBy: req.pharmacistId || dispensedBy,
      quantityDispensed: req.quantityDispensed,
      notes: req.notes,
    };

    await this.producer.send('order.dispensed', payload, {
      userId: dispensedBy,
      userRole: dispensedByRole,
    });

    this.logger.log(`Order ${id} dispensed by ${dispensedBy}`);

    return this.toResponse(updated);
  }

  async findAll(limit = 100, offset = 0): Promise<OrderResponse[]> {
    const results = await this.db
      .select()
      .from(schema.orders)
      .orderBy(desc(schema.orders.createdAt))
      .limit(limit)
      .offset(offset);
    return results.map((r) => this.toResponse(r));
  }

  async getById(id: string): Promise<OrderResponse> {
    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, id))
      .limit(1);
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return this.toResponse(order);
  }

  private toResponse(row: typeof schema.orders.$inferSelect): OrderResponse {
    return {
      id: row.id,
      fhirId: row.fhirId ?? undefined,
      patientId: row.patientId!,
      practitionerId: row.practitionerId!,
      orderType: row.orderType as 'lab' | 'imaging' | 'medication',
      status: row.status as 'active' | 'completed' | 'cancelled' | 'entered-in-error',
      code: row.code,
      display: row.display,
      reason: row.reason ?? undefined,
      notes: row.notes ?? undefined,
      priority: row.priority,
      filledBy: row.filledBy ?? undefined,
      dispensedBy: row.dispensedBy ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
