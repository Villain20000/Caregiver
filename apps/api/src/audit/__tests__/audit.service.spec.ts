/**
 * apps/api/src/audit/__tests__/audit.service.spec.ts
 *
 * Unit tests for AuditService — read-only queries against the audit_log table.
 *
 * The Drizzle Database is mocked (vi.hoisted + chainable query mock) so no
 * real Postgres connection is opened. The mock chain is *thenable*: awaiting
 * a chain that ends at `.limit()` (getByUser / getByResource) or at
 * `.offset()` (findAll) resolves to the current result array — mirroring
 * Drizzle's lazy query execution.
 *
 * drizzle-orm's `eq`/`desc`/`and` are mocked to return identifiable
 * descriptors so tests can assert exactly which predicates were applied.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditService, type AuditLogEntry } from '../audit.service.js';

// ── Hoisted mock state ──────────────────────────────────────────────
const mockState = vi.hoisted(() => {
  const selectResult = { current: [] as unknown[] };

  /**
   * Build a chainable Drizzle query mock.
   *
   * Every chain method returns the chain itself; the chain is thenable so
   * `await` on a chain ending at `.limit()` resolves to `ref.current`.
   * `.offset()` is the explicit terminal used by findAll().
   */
  const makeChain = (ref: { current: unknown[] }) => {
    const c: Record<string, unknown> = {
      // Thenable: resolves to the current result array on await.
      then(resolve: (value: unknown) => void): void {
        resolve(ref.current);
      },
    };
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

// Mock drizzle-orm — eq/and/desc return identifiable descriptors so the
// predicate passed to `.where()` can be asserted.
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  and: vi.fn((...conds: unknown[]) => ({ op: 'and', conds })),
}));

// Mock @caregiver/db — createDb returns our chainable mock DB; the schema
// exposes the auditLog column names used by the service's predicates.
vi.mock('@caregiver/db', () => ({
  createDb: () => mockState.db,
  schema: {
    auditLog: {
      id: 'id',
      userId: 'userId',
      userRole: 'userRole',
      action: 'action',
      resourceType: 'resourceType',
      resourceId: 'resourceId',
      result: 'result',
      errorMessage: 'errorMessage',
      sourceIp: 'sourceIp',
      serviceName: 'serviceName',
      details: 'details',
      occurredAt: 'occurredAt',
    },
  },
}));

describe('AuditService', () => {
  let service: AuditService;

  /** A fully populated audit_log row as Drizzle would return it. */
  const mockRow = {
    id: 'log-1',
    userId: 'user-1',
    userRole: 'doctor',
    action: 'create',
    resourceType: 'Patient',
    resourceId: 'patient-1',
    result: 'success',
    errorMessage: null,
    sourceIp: '10.0.0.1',
    serviceName: 'api',
    details: { foo: 'bar' },
    occurredAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  /** The same row after AuditService.toEntry() mapping. */
  const expectedEntry: AuditLogEntry = {
    id: 'log-1',
    userId: 'user-1',
    userRole: 'doctor',
    action: 'create',
    resourceType: 'Patient',
    resourceId: 'patient-1',
    result: 'success',
    errorMessage: null,
    sourceIp: '10.0.0.1',
    serviceName: 'api',
    details: { foo: 'bar' },
    occurredAt: '2024-01-01T00:00:00.000Z',
  };

  /** The query chain returned by the most recent db.select() call. */
  const lastChain = () =>
    mockState.db.select.mock.results.at(-1)!.value as unknown as {
      where: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      offset: ReturnType<typeof vi.fn>;
    };

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.selectResult.current = [];
    service = new AuditService();
  });

  describe('findAll()', () => {
    it('returns an empty array when there are no logs', async () => {
      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('returns mapped entries with ISO timestamps', async () => {
      mockState.selectResult.current = [mockRow];

      const result = await service.findAll();

      expect(result).toEqual([expectedEntry]);
    });

    it('applies pagination via limit/offset', async () => {
      mockState.selectResult.current = [mockRow];

      await service.findAll(25, 10);

      expect(lastChain().limit).toHaveBeenCalledWith(25);
      expect(lastChain().offset).toHaveBeenCalledWith(10);
    });
  });

  describe('getByUser()', () => {
    it('filters by userId and returns mapped entries', async () => {
      mockState.selectResult.current = [mockRow];

      const result = await service.getByUser('user-1');

      expect(lastChain().where).toHaveBeenCalledWith({
        op: 'eq',
        col: 'userId',
        val: 'user-1',
      });
      expect(lastChain().limit).toHaveBeenCalledWith(100);
      expect(result).toEqual([expectedEntry]);
    });

    it('passes the limit through to the query', async () => {
      mockState.selectResult.current = [mockRow];

      await service.getByUser('user-1', 50);

      expect(lastChain().limit).toHaveBeenCalledWith(50);
    });

    it('returns an empty array when no entries match the user', async () => {
      const result = await service.getByUser('nobody');

      expect(lastChain().where).toHaveBeenCalledWith({
        op: 'eq',
        col: 'userId',
        val: 'nobody',
      });
      expect(result).toEqual([]);
    });
  });

  describe('getByResource()', () => {
    it('filters by resource type AND resource id', async () => {
      mockState.selectResult.current = [mockRow];

      const result = await service.getByResource('Patient', 'patient-1');

      expect(lastChain().where).toHaveBeenCalledWith({
        op: 'and',
        conds: [
          { op: 'eq', col: 'resourceType', val: 'Patient' },
          { op: 'eq', col: 'resourceId', val: 'patient-1' },
        ],
      });
      expect(lastChain().limit).toHaveBeenCalledWith(100);
      expect(result).toEqual([expectedEntry]);
    });

    it('passes the limit through to the query', async () => {
      mockState.selectResult.current = [mockRow];

      await service.getByResource('Patient', 'patient-1', 10);

      expect(lastChain().limit).toHaveBeenCalledWith(10);
    });

    it('returns an empty array when no entries match the resource', async () => {
      const result = await service.getByResource('Observation', 'obs-9');

      expect(lastChain().where).toHaveBeenCalledWith({
        op: 'and',
        conds: [
          { op: 'eq', col: 'resourceType', val: 'Observation' },
          { op: 'eq', col: 'resourceId', val: 'obs-9' },
        ],
      });
      expect(result).toEqual([]);
    });
  });
});
