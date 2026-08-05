/**
 * services/notifications/src/alerts/__tests__/ack-consumer.service.spec.ts
 *
 * Unit tests for AckConsumerService — persists alert acknowledgments
 * (emitted by the API gateway) and mirrors them to the audit trail.
 *
 * `createConsumer` from @caregiver/kafka is mocked and the Drizzle update
 * chain is faked, so no Kafka cluster or Postgres connection is needed.
 * The message handler is driven directly through the captured subscribe
 * handler (same pattern as alert-consumer.service.spec.ts in apps/api).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AckConsumerService } from '../ack-consumer.service.js';

// ── Mock @caregiver/kafka — capture the subscription handler ──
const subscribeHandler: { current: ((envelope: { payload: unknown }) => Promise<void>) | null } =
  vi.hoisted(() => ({ current: null }));

const fakeConsumer = vi.hoisted(() => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockImplementation(async (_topic: string, handler: unknown) => {
    subscribeHandler.current = handler as typeof subscribeHandler.current;
  }),
}));

vi.mock('@caregiver/kafka', () => ({
  createConsumer: () => fakeConsumer,
}));

// ── Mock @caregiver/db + drizzle-orm (chainable update mock) ──
// The service chain is update().set(...).where(...).returning().
const mockUpdateState = vi.hoisted(() => {
  const returningResult = { current: [] as unknown[] };
  const returning = vi.fn(() => Promise.resolve(returningResult.current));
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { update, set, where, returning, returningResult };
});

vi.mock('@caregiver/db', () => ({
  createDb: () => ({}),
  schema: { alerts: { id: 'id' } },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
}));

describe('AckConsumerService', () => {
  let service: AckConsumerService;
  const producer = { send: vi.fn().mockResolvedValue([]) };
  const db = { update: mockUpdateState.update } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    subscribeHandler.current = null;
    mockUpdateState.returningResult.current = [];
    service = new AckConsumerService(db, producer as never);
  });

  it('connects and subscribes to alert.acknowledged on init', async () => {
    await service.onModuleInit();

    expect(fakeConsumer.connect).toHaveBeenCalledTimes(1);
    expect(fakeConsumer.subscribe).toHaveBeenCalledTimes(1);
    expect(fakeConsumer.subscribe).toHaveBeenCalledWith('alert.acknowledged', expect.any(Function));
  });

  it('persists the acknowledgment and mirrors it to the audit trail', async () => {
    await service.onModuleInit();
    // The update must affect a row so the returning() guard passes.
    mockUpdateState.returningResult.current = [{ id: 'alert-1' }];

    await subscribeHandler.current!({
      payload: {
        alertId: 'alert-1',
        acknowledgedBy: 'doctor-1',
        acknowledgedAt: '2026-07-01T00:10:00.000Z',
      },
    });

    // DB update: acknowledged=true with the acknowledged fields.
    expect(mockUpdateState.update).toHaveBeenCalledTimes(1);
    expect(mockUpdateState.set).toHaveBeenCalledTimes(1);
    const setArg = mockUpdateState.set.mock.calls[0]![0];
    expect(setArg.acknowledged).toBe(true);
    expect(setArg.acknowledgedBy).toBe('doctor-1');
    expect(setArg.acknowledgedAt).toBeInstanceOf(Date);
    expect(setArg.acknowledgedAt.toISOString()).toBe('2026-07-01T00:10:00.000Z');

    // Audit mirror.
    const auditCall = producer.send.mock.calls.find(
      (c: unknown[]) => (c as string[])[0] === 'audit.event',
    );
    expect(auditCall).toBeDefined();
    expect(auditCall![1]).toMatchObject({
      action: 'update',
      resourceType: 'alerts',
      resourceId: 'alert-1',
      result: 'success',
      details: { acknowledged: true, acknowledgedBy: 'doctor-1' },
    });
  });

  it('skips the audit mirror when the alert row does not exist (0 rows updated)', async () => {
    await service.onModuleInit();
    // returningResult.current stays [] → the update affected 0 rows.

    await subscribeHandler.current!({
      payload: {
        alertId: 'missing-alert',
        acknowledgedBy: 'doctor-1',
        acknowledgedAt: '2026-07-01T00:10:00.000Z',
      },
    });

    // The update ran, but no audit.event was emitted.
    expect(mockUpdateState.update).toHaveBeenCalledTimes(1);
    expect(producer.send).not.toHaveBeenCalled();
  });

  it('disconnects cleanly on destroy', async () => {
    await service.onModuleDestroy();
    expect(fakeConsumer.disconnect).toHaveBeenCalledTimes(1);
  });
});
