/**
 * apps/api/src/billing/__tests__/billing.service.spec.ts
 *
 * Unit tests for BillingService.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BillingService } from '../billing.service.js';
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
  schema: { claims: { id: 'id' } },
}));

describe('BillingService', () => {
  let service: BillingService;
  let producer: { send: ReturnType<typeof vi.fn> };

  const mockClaim = {
    id: 'claim-123',
    fhirId: null,
    patientId: 'patient-1',
    providerId: 'provider-1',
    insurerId: 'insurer-1',
    status: 'draft',
    type: 'professional',
    use: 'claim',
    totalAmount: 500000,
    amountApproved: null,
    amountPaid: null,
    items: [],
    submittedAt: null,
    adjudicatedAt: null,
    paidAt: null,
    createdAt: new Date('2024-06-01T00:00:00Z'),
    updatedAt: new Date('2024-06-01T00:00:00Z'),
  };

  beforeEach(async () => {
    mockState.selectResult.current = [];
    mockState.insertResult.current = [];
    mockState.updateResult.current = [];
    producer = { send: vi.fn().mockResolvedValue(undefined) };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [BillingService, { provide: KAFKA_PRODUCER, useValue: producer }],
    }).compile();
    service = moduleRef.get(BillingService);
  });

  describe('createClaim()', () => {
    it('creates a claim and emits Kafka event', async () => {
      mockState.insertResult.current = [mockClaim];
      const result = await service.createClaim(
        {
          patientId: 'patient-1',
          providerId: 'provider-1',
          insurerId: 'insurer-1',
          type: 'professional',
          use: 'claim',
          items: [
            {
              serviceDate: '2024-06-01',
              code: '99213',
              display: 'Office Visit',
              quantity: 1,
              unitPrice: 200,
              netAmount: 200,
            },
          ],
        },
        'user-1',
        'billing_specialist',
      );
      expect(result.id).toBe('claim-123');
      expect(producer.send).toHaveBeenCalledWith(
        'claim.created',
        expect.any(Object),
        expect.any(Object),
      );
    });
  });

  describe('getClaimById()', () => {
    it('throws NotFoundException when claim does not exist', async () => {
      mockState.selectResult.current = [];
      await expect(service.getClaimById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
