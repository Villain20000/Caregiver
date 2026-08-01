/**
 * apps/api/src/vitals/__tests__/vitals.service.spec.ts
 *
 * Unit tests for VitalsService.
 *
 * Uses the same vi.hoisted() mock pattern as appointment.service.spec.ts
 * to mock the Drizzle DB and Kafka producer.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { VitalsService } from '../vitals.service.js';
import { KAFKA_PRODUCER } from '../../kafka/kafka.module.js';

const mockState = vi.hoisted(() => {
  const selectResult = { current: [] as unknown[] };
  const insertResult = { current: [] as unknown[] };
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
      update: vi.fn(() => makeChain({ current: [] })),
    },
    selectResult,
    insertResult,
  };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}));

vi.mock('@caregiver/db', () => ({
  createDb: () => mockState.db,
  schema: {
    vitals: { id: 'id', patientId: 'patientId', recordedAt: 'recordedAt' },
    appointments: { id: 'id' },
  },
}));

describe('VitalsService', () => {
  let service: VitalsService;
  let producer: { send: ReturnType<typeof vi.fn> };

  const mockVitals = {
    id: 'vitals-123',
    fhirId: null,
    patientId: 'patient-1',
    recordedBy: 'nurse-1',
    heartRate: 72,
    systolicBp: 120,
    diastolicBp: 80,
    temperature: 3700,
    oxygenSaturation: 98,
    respiratoryRate: null,
    fhirResource: null,
    recordedAt: new Date('2024-06-01T00:00:00Z'),
    createdAt: new Date('2024-06-01T00:00:00Z'),
  };

  beforeEach(async () => {
    mockState.selectResult.current = [];
    mockState.insertResult.current = [];
    producer = { send: vi.fn().mockResolvedValue(undefined) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [VitalsService, { provide: KAFKA_PRODUCER, useValue: producer }],
    }).compile();
    service = moduleRef.get(VitalsService);
  });

  describe('record()', () => {
    it('inserts vitals and emits a Kafka event', async () => {
      mockState.insertResult.current = [mockVitals];

      const result = await service.record(
        { patientId: 'patient-1', heartRate: 72 },
        'nurse-1',
        'nurse',
      );

      expect(result.heartRate).toBe(72);
      expect(producer.send).toHaveBeenCalledWith(
        'vitals.recorded',
        expect.objectContaining({ patientId: 'patient-1' }),
        expect.any(Object),
      );
    });
  });

  describe('getLatestForPatient()', () => {
    it('returns null when no vitals exist', async () => {
      mockState.selectResult.current = [];
      const result = await service.getLatestForPatient('patient-1');
      expect(result).toBeNull();
    });
  });
});
