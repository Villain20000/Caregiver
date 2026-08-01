/**
 * apps/api/src/audit/__tests__/audit.service.spec.ts
 *
 * Unit tests for AuditService.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditService } from '../audit.service.js';

const mockState = vi.hoisted(() => {
  const selectResult = { current: [] as unknown[] };
  const makeChain = (ref: { current: unknown[] }) => {
    const c: Record<string, ReturnType<typeof vi.fn>> = {};
    c.from = vi.fn(() => c);
    c.where = vi.fn(() => c);
    c.orderBy = vi.fn(() => c);
    c.limit = vi.fn(() => c);
    c.offset = vi.fn(() => Promise.resolve(ref.current));
    return c;
  };
  return {
    db: { select: vi.fn(() => makeChain(selectResult)) },
    selectResult,
  };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}));
vi.mock('@caregiver/db', () => ({
  createDb: () => mockState.db,
  schema: { auditLog: { id: 'id' } },
}));

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    mockState.selectResult.current = [];
    service = new AuditService();
  });

  describe('findAll()', () => {
    it('returns an empty array when there are no logs', async () => {
      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });
});
