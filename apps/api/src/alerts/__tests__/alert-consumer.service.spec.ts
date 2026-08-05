/**
 * apps/api/src/alerts/__tests__/alert-consumer.service.spec.ts
 *
 * Unit tests for AlertConsumerService — the Kafka consumer that forwards
 * `alert.dispatched` events to the Socket.io gateway for real-time delivery.
 *
 * `createConsumer` from @caregiver/kafka is mocked so no Kafka cluster is
 * contacted; the test drives onModuleInit() and then invokes the captured
 * message handler directly to assert the gateway is called.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AlertDispatchedPayload } from '@caregiver/contracts';
import { AlertConsumerService, CONNECT_RETRY_MS } from '../alert-consumer.service.js';
import type { AlertsGateway } from '../alerts.gateway.js';

// ── Mock @caregiver/kafka — capture the consumer + subscription handler ──
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

describe('AlertConsumerService', () => {
  let service: AlertConsumerService;
  const gateway = { broadcastAlert: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    subscribeHandler.current = null;
    service = new AlertConsumerService(gateway as unknown as AlertsGateway);
  });

  it('connects and subscribes to alert.dispatched on init', async () => {
    await service.onModuleInit();

    expect(fakeConsumer.connect).toHaveBeenCalledTimes(1);
    expect(fakeConsumer.subscribe).toHaveBeenCalledTimes(1);
    expect(fakeConsumer.subscribe).toHaveBeenCalledWith('alert.dispatched', expect.any(Function));
  });

  it('forwards a dispatched alert to the gateway', async () => {
    await service.onModuleInit();

    const payload: AlertDispatchedPayload = {
      alertId: 'alert-1',
      patientId: 'patient-42',
      alertType: 'vital_threshold',
      severity: 'critical',
      message: 'Critical: Heart rate 190 bpm',
      targetRoles: ['doctor', 'nurse'],
      createdAt: '2026-07-01T00:00:00.000Z',
    };

    await subscribeHandler.current!({ payload });

    expect(gateway.broadcastAlert).toHaveBeenCalledTimes(1);
    expect(gateway.broadcastAlert).toHaveBeenCalledWith(payload);
  });

  it('forwards escalation dispatches (escalated: true) unchanged', async () => {
    await service.onModuleInit();

    const payload: AlertDispatchedPayload = {
      alertId: 'alert-2',
      patientId: 'patient-42',
      alertType: 'vital_threshold',
      severity: 'emergency',
      message: 'ESCALATED: Critical: Heart rate 190 bpm',
      targetRoles: ['doctor', 'nurse', 'medical_director', 'admin'],
      escalated: true,
      createdAt: '2026-07-01T00:00:00.000Z',
    };

    await subscribeHandler.current!({ payload });

    expect(gateway.broadcastAlert).toHaveBeenCalledWith(payload);
    // The escalation flag must reach the gateway untouched so the UI can
    // render the alert distinctly.
    expect(gateway.broadcastAlert.mock.calls[0]![0].escalated).toBe(true);
  });

  it('disconnects cleanly on destroy', async () => {
    await service.onModuleDestroy();
    expect(fakeConsumer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not crash when Kafka connect fails — retries in the background', async () => {
    vi.useFakeTimers();
    try {
      // First connect attempt fails (broker down)…
      fakeConsumer.connect.mockRejectedValueOnce(new Error('broker unreachable'));

      // …but onModuleInit must NOT throw: the API gateway (BFF) must still boot.
      await service.onModuleInit();
      expect(fakeConsumer.connect).toHaveBeenCalledTimes(1);
      expect(fakeConsumer.subscribe).not.toHaveBeenCalled();

      // Advancing the retry timer triggers a reconnect attempt.
      await vi.advanceTimersByTimeAsync(CONNECT_RETRY_MS);
      expect(fakeConsumer.connect).toHaveBeenCalledTimes(2);
      expect(fakeConsumer.subscribe).toHaveBeenCalledWith('alert.dispatched', expect.any(Function));
    } finally {
      vi.useRealTimers();
    }
  });
});
