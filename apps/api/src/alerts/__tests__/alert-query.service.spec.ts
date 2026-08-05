/**
 * apps/api/src/alerts/__tests__/alert-query.service.spec.ts
 *
 * Unit tests for AlertQueryService — the read-only compliance API that
 * reports alert acknowledgment/escalation state.
 *
 * Uses the same vi.hoisted() chainable mock pattern as
 * vitals.service.spec.ts to fake the Drizzle DB (no Postgres connection),
 * with `offset` added to the select chain for pagination.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlertQueryService } from '../alert-query.service.js';
import type { AlertSeverity } from '@caregiver/contracts';

const mockState = vi.hoisted(() => {
  const selectResult = { current: [] as unknown[] };
  const makeChain = (ref: { current: unknown[] }) => {
    const c: Record<string, unknown> = {};
    c.from = vi.fn(() => c);
    c.where = vi.fn(() => c);
    c.orderBy = vi.fn(() => c);
    c.limit = vi.fn(() => c);
    c.offset = vi.fn(() => Promise.resolve(ref.current));
    // Thenable: summary() ends its chain at .limit() (no .offset()), so
    // awaiting the chain object must resolve to the rows.
    c.then = (resolve: (v: unknown) => void) => resolve(ref.current);
    return c;
  };
  return {
    db: { select: vi.fn(() => makeChain(selectResult)) },
    selectResult,
  };
});

const mockDrizzle = vi.hoisted(() => ({
  eq: vi.fn(() => ({})),
  and: vi.fn((...conds: unknown[]) => conds),
  desc: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
}));

vi.mock('drizzle-orm', () => mockDrizzle);

vi.mock('@caregiver/db', () => ({
  createDb: () => mockState.db,
  schema: {
    alerts: {
      id: 'id',
      patientId: 'patientId',
      alertType: 'alertType',
      severity: 'severity',
      message: 'message',
      acknowledged: 'acknowledged',
      acknowledgedBy: 'acknowledgedBy',
      acknowledgedAt: 'acknowledgedAt',
      escalated: 'escalated',
      metadata: 'metadata',
      createdAt: 'createdAt',
    },
  },
}));

/** Build a drizzle-shaped alert row. */
const alertRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'alert-1',
  patientId: 'patient-42',
  alertType: 'vital_threshold',
  severity: 'critical' as AlertSeverity,
  message: 'Critical: Heart rate 190 bpm',
  acknowledged: false,
  acknowledgedBy: null,
  acknowledgedAt: null,
  escalated: false,
  metadata: { vitalsId: 'vitals-1' },
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

describe('AlertQueryService', () => {
  let service: AlertQueryService;

  beforeEach(() => {
    // Reset call history so `select.mock.results[0]` refers to the current
    // test's chain (not the first select call across the whole file).
    vi.clearAllMocks();
    mockState.selectResult.current = [];
    service = new AlertQueryService();
  });

  describe('findByPatient()', () => {
    it('filters by patientId and maps rows to the response shape', async () => {
      mockState.selectResult.current = [
        alertRow({
          id: 'alert-1',
          acknowledged: true,
          acknowledgedBy: 'doctor-1',
          acknowledgedAt: new Date('2026-07-01T00:10:00.000Z'),
          escalated: true,
          metadata: { vitalsId: 'vitals-1', escalatedAt: '2026-07-01T00:15:00.000Z' },
        }),
      ];

      const result = await service.findByPatient('patient-42');

      expect(result).toHaveLength(1);
      const row = result[0]!;
      expect(row.id).toBe('alert-1');
      expect(row.patientId).toBe('patient-42');
      // First-class escalatedAt lifted from metadata.
      expect(row.escalated).toBe(true);
      expect(row.escalatedAt).toBe('2026-07-01T00:15:00.000Z');
      expect(row.acknowledgedBy).toBe('doctor-1');
      expect(row.acknowledgedAt).toBe('2026-07-01T00:10:00.000Z');
      expect(row.createdAt).toBe('2026-07-01T00:00:00.000Z');
    });

    it('returns escalatedAt null when metadata has no escalation timestamp', async () => {
      mockState.selectResult.current = [alertRow()];
      const result = await service.findByPatient('patient-42');
      expect(result[0]!.escalated).toBe(false);
      expect(result[0]!.escalatedAt).toBeNull();
    });

    it('returns an empty array when no alerts exist', async () => {
      const result = await service.findByPatient('patient-999');
      expect(result).toEqual([]);
    });
  });

  describe('findAll()', () => {
    it('passes severity + ack/escalation filters through to the query', async () => {
      mockState.selectResult.current = [alertRow({ id: 'alert-2', severity: 'emergency' })];

      const result = await service.findAll({
        severity: 'emergency',
        acknowledged: false,
        escalated: true,
        limit: 50,
        offset: 10,
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.severity).toBe('emergency');
    });

    it('applies the default pagination when no limit/offset given', async () => {
      mockState.selectResult.current = [];
      await service.findAll();
      const chain = mockState.db.select.mock.results[0]!.value;
      expect(chain.limit).toHaveBeenCalledWith(100);
      expect(chain.offset).toHaveBeenCalledWith(0);
    });

    it('coerces string query params (as sent by the browser) into real booleans/ints', async () => {
      mockState.selectResult.current = [alertRow({ id: 'alert-3', acknowledged: true })];

      await service.findAll({
        acknowledged: 'true',
        escalated: 'false',
        limit: '50',
        offset: '10',
      } as unknown as Parameters<typeof service.findAll>[0]);

      // eq() received the COERCED boolean, never the raw string.
      expect(mockDrizzle.eq).toHaveBeenCalledWith('acknowledged', true);
      expect(mockDrizzle.eq).toHaveBeenCalledWith('escalated', false);

      // Pagination params were converted to real integers.
      const chain = mockState.db.select.mock.results[0]!.value;
      expect(chain.limit).toHaveBeenCalledWith(50);
      expect(chain.offset).toHaveBeenCalledWith(10);
    });

    it('ignores invalid severity values instead of hitting the DB enum', async () => {
      mockState.selectResult.current = [];
      await service.findAll({ severity: 'bogus' } as unknown as Parameters<
        typeof service.findAll
      >[0]);
      expect(mockDrizzle.eq).not.toHaveBeenCalledWith('severity', 'bogus');
    });
  });

  describe('summary()', () => {
    it('computes counts and rates across the returned rows', async () => {
      mockState.selectResult.current = [
        alertRow({ id: 'a', severity: 'critical', acknowledged: true, escalated: true }),
        alertRow({ id: 'b', severity: 'warning', acknowledged: false, escalated: false }),
        alertRow({ id: 'c', severity: 'critical', acknowledged: true, escalated: false }),
        alertRow({ id: 'd', severity: 'emergency', acknowledged: false, escalated: false }),
      ];

      const summary = await service.summary();

      expect(summary.total).toBe(4);
      expect(summary.bySeverity).toEqual({ info: 0, warning: 1, critical: 2, emergency: 1 });
      expect(summary.acknowledged).toBe(2);
      expect(summary.unacknowledged).toBe(2);
      expect(summary.escalated).toBe(1);
      expect(summary.ackRate).toBe(0.5);
      expect(summary.escalationRate).toBe(0.25);
    });

    it('returns zeroed counts and 0 rates when there are no alerts', async () => {
      const summary = await service.summary();
      expect(summary).toEqual({
        total: 0,
        bySeverity: { info: 0, warning: 0, critical: 0, emergency: 0 },
        acknowledged: 0,
        unacknowledged: 0,
        escalated: 0,
        ackRate: 0,
        escalationRate: 0,
      });
    });
  });
});
