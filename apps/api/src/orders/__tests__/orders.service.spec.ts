/**
 * apps/api/src/orders/__tests__/orders.service.spec.ts
 *
 * Unit tests for OrdersService.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrdersService } from '../orders.service.js';
import { KAFKA_PRODUCER } from '../../kafka/kafka.module.js';

const mockState = vi.hoisted(() => {
  const selectResult = { current: [] as unknown[] };
  const insertResult = { current: [] as unknown[] };
  const updateResult = { current: [] as unknown[] };
  const makeChain = (ref: { current: unknown[] }) => {
    const c: Record<string, ReturnType<typeof vi.fn>> = {};
    c.from = vi.fn(() => c);
    c.where = vi.fn(() => c);
    c.orderBy = vi.fn(() => c);
    c.limit = vi.fn(() => Promise.resolve(ref.current));
    c.values = vi.fn(() => c);
    c.set = vi.fn(() => c);
    c.returning = vi.fn(() => Promise.resolve(ref.current));
    return c;
  };
  return {
    db: {
      select: vi.fn(() => makeChain(selectResult)),
      insert: vi.fn(() => makeChain(insertResult)),
      update: vi.fn(() => makeChain(updateResult)),
    },
    selectResult,
    insertResult,
    updateResult,
  };
});

vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({})), desc: vi.fn(() => ({})) }));
vi.mock('@caregiver/db', () => ({
  createDb: () => mockState.db,
  schema: { orders: { id: 'id' } },
}));

describe('OrdersService', () => {
  let service: OrdersService;
  let producer: { send: ReturnType<typeof vi.fn> };

  const mockOrder = {
    id: 'order-123',
    fhirId: null,
    patientId: 'patient-1',
    practitionerId: 'doctor-1',
    orderType: 'lab',
    status: 'active',
    code: 'LOINC-123',
    display: 'Complete Blood Count',
    reason: null,
    notes: null,
    priority: 'routine',
    filledBy: null,
    dispensedBy: null,
    createdAt: new Date('2024-06-01T00:00:00Z'),
    updatedAt: new Date('2024-06-01T00:00:00Z'),
  };

  beforeEach(async () => {
    mockState.selectResult.current = [];
    mockState.insertResult.current = [];
    mockState.updateResult.current = [];
    producer = { send: vi.fn().mockResolvedValue(undefined) };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: KAFKA_PRODUCER, useValue: producer }],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  describe('createOrder()', () => {
    it('creates a lab order and emits Kafka event', async () => {
      mockState.insertResult.current = [mockOrder];
      const result = await service.createOrder(
        {
          patientId: 'patient-1',
          practitionerId: 'doctor-1',
          orderType: 'lab',
          code: 'LOINC-123',
          display: 'CBC',
        },
        'doctor-1',
        'doctor',
      );
      expect(result.id).toBe('order-123');
      expect(producer.send).toHaveBeenCalledWith(
        'order.created',
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('getById()', () => {
    it('throws NotFoundException when order does not exist', async () => {
      mockState.selectResult.current = [];
      await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
