/**
 * services/notifications/src/alerts/__tests__/escalation.service.spec.ts
 *
 * Unit tests for EscalationService — the sweeper that escalates
 * unacknowledged critical/emergency alerts.
 *
 * Pure helpers (isEligibleForEscalation, escalationPayloadFor) are tested
 * directly. escalateAlert() is tested with a chainable Drizzle mock + a
 * fake Kafka producer so no real DB or Kafka connection is opened.
 *
 * NOTE: the poll timer is NOT exercised here (it would require fake timers
 * and a live DB) — checkDueEscalations() + escalateAlert() are the public
 * seams the timer calls, and they are fully covered.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AlertDispatchedPayload } from '@caregiver/contracts';
import {
  EscalationService,
  escalationPayloadFor,
  escalationTimeoutMs,
  escalationPollMs,
  isEligibleForEscalation,
  ESCALATION_TARGET_ROLES,
  type EscalatableAlertRow,
} from '../escalation.service.js';

/** Build a test alert row (eligible by default: old, critical, unacknowledged). */
const alertRow = (overrides: Partial<EscalatableAlertRow> = {}): EscalatableAlertRow => ({
  id: 'alert-1',
  patientId: 'patient-42',
  alertType: 'vital_threshold',
  severity: 'critical',
  message: 'Critical: Heart rate 190 bpm for patient patient-42',
  acknowledged: false,
  escalated: false,
  metadata: { vitalsId: 'vitals-1' },
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  ...overrides,
});

describe('EscalationService (pure helpers)', () => {
  it('isEligibleForEscalation returns true for a stale unacknowledged alert', () => {
    const cutoff = new Date('2026-07-01T01:00:00.000Z');
    expect(isEligibleForEscalation(alertRow(), cutoff)).toBe(true);
  });

  it('isEligibleForEscalation returns false when acknowledged', () => {
    const cutoff = new Date('2026-07-01T01:00:00.000Z');
    expect(isEligibleForEscalation(alertRow({ acknowledged: true }), cutoff)).toBe(false);
  });

  it('isEligibleForEscalation returns false when already escalated', () => {
    const cutoff = new Date('2026-07-01T01:00:00.000Z');
    expect(isEligibleForEscalation(alertRow({ escalated: true }), cutoff)).toBe(false);
  });

  it('isEligibleForEscalation returns false when the alert is younger than the cutoff', () => {
    const cutoff = new Date('2026-06-30T00:00:00.000Z'); // cutoff BEFORE createdAt
    expect(isEligibleForEscalation(alertRow(), cutoff)).toBe(false);
  });

  it('escalationPayloadFor forces emergency severity and marks escalated', () => {
    const payload = escalationPayloadFor(alertRow());
    expect(payload.escalated).toBe(true);
    expect(payload.severity).toBe('emergency');
    expect(payload.alertId).toBe('alert-1');
    expect(payload.targetRoles).toEqual([...ESCALATION_TARGET_ROLES]);
  });

  it('escalationPayloadFor prefixes the message and preserves metadata + original severity', () => {
    const payload = escalationPayloadFor(alertRow());
    expect(payload.message).toBe('ESCALATED: Critical: Heart rate 190 bpm for patient patient-42');
    expect(payload.metadata).toMatchObject({
      vitalsId: 'vitals-1', // original metadata preserved
      escalated: true,
      originalSeverity: 'critical',
    });
    expect(typeof payload.metadata?.escalatedAt).toBe('string');
  });

  it('escalationPayloadFor survives a null patientId and null metadata', () => {
    const payload = escalationPayloadFor(alertRow({ patientId: null, metadata: null }));
    expect(payload.patientId).toBe('unknown');
    expect(payload.metadata?.escalated).toBe(true);
  });

  it('env defaults are 15min timeout and 30s poll', () => {
    delete process.env.ALERT_ESCALATION_TIMEOUT_MS;
    delete process.env.ALERT_ESCALATION_POLL_MS;
    expect(escalationTimeoutMs()).toBe(15 * 60 * 1000);
    expect(escalationPollMs()).toBe(30 * 1000);
  });

  it('env overrides are respected', () => {
    process.env.ALERT_ESCALATION_TIMEOUT_MS = '5000';
    process.env.ALERT_ESCALATION_POLL_MS = '1000';
    expect(escalationTimeoutMs()).toBe(5000);
    expect(escalationPollMs()).toBe(1000);
    delete process.env.ALERT_ESCALATION_TIMEOUT_MS;
    delete process.env.ALERT_ESCALATION_POLL_MS;
  });

  it('garbage env values fall back to defaults', () => {
    process.env.ALERT_ESCALATION_TIMEOUT_MS = 'not-a-number';
    expect(escalationTimeoutMs()).toBe(15 * 60 * 1000);
    delete process.env.ALERT_ESCALATION_TIMEOUT_MS;
  });
});

describe('EscalationService (DB + Kafka interactions)', () => {
  // ── Chainable Drizzle mocks ─────────────────────────────────
  const mockWhere = vi.fn();
  const mockSelectFrom = vi.fn();
  const mockUpdateSet = vi.fn();
  const mockUpdateWhere = vi.fn();

  const mockDb = {
    select: vi.fn(() => ({ from: mockSelectFrom })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
  };
  // The mocked DB module also needs `schema` + `eq`/`and`/`lt`/`inArray`.
  // We stub @caregiver/db and drizzle-orm below.

  const producer = { send: vi.fn().mockResolvedValue([]) };
  let service: EscalationService;

  beforeEach(() => {
    vi.clearAllMocks();
    // select().from().where(...) chain
    mockSelectFrom.mockReturnValue({ where: mockWhere });
    // update().set(...).where(...) chain
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });

    service = new EscalationService(mockDb as never, producer as never);
  });

  it('escalateAlert marks the row escalated, re-dispatches, and audits', async () => {
    mockUpdateWhere.mockResolvedValue([]);

    await service.escalateAlert(alertRow());

    // DB update: escalated=true + metadata carries escalatedAt.
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockUpdateSet).toHaveBeenCalledTimes(1);
    const setArg = mockUpdateSet.mock.calls[0]![0];
    expect(setArg.escalated).toBe(true);
    expect(setArg.metadata.escalatedAt).toEqual(expect.any(String));

    // Kafka: escalation dispatch with the widened roles.
    const dispatchCall = producer.send.mock.calls.find(
      (c: unknown[]) => (c as string[])[0] === 'alert.dispatched',
    );
    expect(dispatchCall).toBeDefined();
    const payload = dispatchCall[1] as AlertDispatchedPayload;
    expect(payload.escalated).toBe(true);
    expect(payload.severity).toBe('emergency');
    expect(payload.targetRoles).toEqual([...ESCALATION_TARGET_ROLES]);

    // Kafka: audit mirror.
    const auditCall = producer.send.mock.calls.find(
      (c: unknown[]) => (c as string[])[0] === 'audit.event',
    );
    expect(auditCall).toBeDefined();
    expect(auditCall[1]).toMatchObject({
      action: 'update',
      resourceType: 'alerts',
      resourceId: 'alert-1',
      result: 'success',
    });
  });

  it('checkDueEscalations escalates only eligible rows and returns the count', async () => {
    // One due row + one already-acknowledged row returned by the query.
    mockWhere.mockResolvedValue([
      alertRow({ id: 'due-1', createdAt: new Date('2026-01-01T00:00:00.000Z') }),
      alertRow({
        id: 'ack-1',
        acknowledged: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ]);
    mockUpdateWhere.mockResolvedValue([]);

    const count = await service.checkDueEscalations();

    expect(count).toBe(1);
    // Only the due alert was escalated.
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it('checkDueEscalations escalates nothing when the query is empty', async () => {
    mockWhere.mockResolvedValue([]);

    const count = await service.checkDueEscalations();

    expect(count).toBe(0);
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(producer.send).not.toHaveBeenCalled();
  });
});
