/**
 * apps/api/src/alerts/__tests__/alerts.gateway.spec.ts
 *
 * Unit tests for AlertsGateway — focuses on the acknowledgment handler,
 * which must NOT write to the database (BFF pattern). Instead it emits an
 * `alert.acknowledged` Kafka event via the injected producer; the
 * notifications service persists the ack.
 *
 * The gateway is constructed directly with a fake JwtService + fake
 * producer; `handleAcknowledge()` is invoked like the Socket.io layer
 * would (client + message body).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Socket } from 'socket.io';
import { AlertsGateway } from '../alerts.gateway.js';
import type { TypedProducer } from '@caregiver/kafka';
import type { UserProfile } from '@caregiver/contracts';

/** Build a gateway with a fake producer. */
const makeGateway = (producer: Pick<TypedProducer, 'send'>): AlertsGateway =>
  new AlertsGateway({ verify: vi.fn() } as never, producer as never);

/** Build a fake connected client (or unauthenticated when no user given). */
const makeClient = (user?: UserProfile): Socket =>
  ({ id: 'client-1', data: { user } }) as unknown as Socket;

describe('AlertsGateway — handleAcknowledge', () => {
  let producer: { send: ReturnType<typeof vi.fn> };
  let gateway: AlertsGateway;

  beforeEach(() => {
    producer = { send: vi.fn().mockResolvedValue([]) };
    gateway = makeGateway(producer);
  });

  it('emits an alert.acknowledged Kafka event (no direct DB write)', async () => {
    const client = makeClient({
      id: 'doctor-1',
      email: 'd@c.test',
      fullName: 'Dr',
      role: 'doctor',
      isActive: true,
    });

    const result = await gateway.handleAcknowledge(client, { alertId: 'alert-1' });

    expect(result).toEqual({ success: true });
    expect(producer.send).toHaveBeenCalledTimes(1);
    const [topic, payload, metadata] = producer.send.mock.calls[0]!;

    expect(topic).toBe('alert.acknowledged');
    expect(payload).toMatchObject({
      alertId: 'alert-1',
      acknowledgedBy: 'doctor-1',
    });
    expect(typeof payload.acknowledgedAt).toBe('string');
    expect(metadata).toMatchObject({
      correlationId: 'alert-1',
      userId: 'doctor-1',
      userRole: 'doctor',
    });
  });

  it('returns success:false for an unauthenticated client and sends nothing', async () => {
    const result = await gateway.handleAcknowledge(makeClient(undefined), { alertId: 'alert-1' });

    expect(result).toEqual({ success: false });
    expect(producer.send).not.toHaveBeenCalled();
  });

  it('rejects an empty alertId without dispatching', async () => {
    const client = makeClient({
      id: 'doctor-1',
      email: 'd@c.test',
      fullName: 'Dr',
      role: 'doctor',
      isActive: true,
    });

    const result = await gateway.handleAcknowledge(client, { alertId: '' });

    expect(result).toEqual({ success: false });
    expect(producer.send).not.toHaveBeenCalled();
  });

  it('rejects a missing alertId without dispatching (untrusted socket body)', async () => {
    const client = makeClient({
      id: 'doctor-1',
      email: 'd@c.test',
      fullName: 'Dr',
      role: 'doctor',
      isActive: true,
    });

    // A malformed client payload (no alertId field) must not crash the
    // handler or dispatch an event.
    const result = await gateway.handleAcknowledge(client, {} as { alertId: string });

    expect(result).toEqual({ success: false });
    expect(producer.send).not.toHaveBeenCalled();
  });

  it('rejects a completely missing message body without dispatching', async () => {
    const client = makeClient({
      id: 'doctor-1',
      email: 'd@c.test',
      fullName: 'Dr',
      role: 'doctor',
      isActive: true,
    });

    // @MessageBody() yields undefined when a client emits with no payload.
    const result = await gateway.handleAcknowledge(
      client,
      undefined as unknown as { alertId: string },
    );

    expect(result).toEqual({ success: false });
    expect(producer.send).not.toHaveBeenCalled();
  });

  it('rejects a non-string alertId without dispatching', async () => {
    const client = makeClient({
      id: 'doctor-1',
      email: 'd@c.test',
      fullName: 'Dr',
      role: 'doctor',
      isActive: true,
    });

    const result = await gateway.handleAcknowledge(client, { alertId: 123 } as unknown as {
      alertId: string;
    });

    expect(result).toEqual({ success: false });
    expect(producer.send).not.toHaveBeenCalled();
  });

  it('returns success:false when the Kafka send fails', async () => {
    producer.send.mockRejectedValueOnce(new Error('broker unreachable'));
    const client = makeClient({
      id: 'doctor-1',
      email: 'd@c.test',
      fullName: 'Dr',
      role: 'doctor',
      isActive: true,
    });

    const result = await gateway.handleAcknowledge(client, { alertId: 'alert-1' });

    expect(result).toEqual({ success: false });
  });
});
