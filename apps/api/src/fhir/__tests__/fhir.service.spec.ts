/**
 * apps/api/src/fhir/__tests__/fhir.service.spec.ts
 *
 * Unit tests for FhirService.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { FhirService } from '../fhir.service.js';
import { KAFKA_PRODUCER } from '../../kafka/kafka.module.js';

const mockState = vi.hoisted(() => {
  const selectResult = { current: [] as unknown[] };
  const makeChain = (ref: { current: unknown[] }) => {
    const c: Record<string, ReturnType<typeof vi.fn>> = {};
    c.from = vi.fn(() => c);
    c.where = vi.fn(() => c);
    c.orderBy = vi.fn(() => c);
    c.limit = vi.fn(() => Promise.resolve(ref.current));
    return c;
  };
  return {
    db: { select: vi.fn(() => makeChain(selectResult)), insert: vi.fn() },
    selectResult,
  };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  like: vi.fn(() => ({})),
}));

vi.mock('@caregiver/db', () => ({
  createDb: () => mockState.db,
  schema: { fhirResources: { id: 'id' } },
}));

describe('FhirService', () => {
  let service: FhirService;
  let producer: { send: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    producer = { send: vi.fn().mockResolvedValue(undefined) };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [FhirService, { provide: KAFKA_PRODUCER, useValue: producer }],
    }).compile();
    service = moduleRef.get(FhirService);
  });

  describe('ingestBundle()', () => {
    it('validates a minimal bundle with one entry', async () => {
      const result = await service.ingestBundle(
        { resourceType: 'Bundle', entry: [{ resource: { resourceType: 'Patient', id: 'p-1' } }] },
        'test-system',
      );
      expect(result.valid).toBe(true);
      expect(result.totalResources).toBe(1);
      expect(producer.send).toHaveBeenCalledWith('fhir.resource.ingested', expect.any(Object));
    });
  });
});
