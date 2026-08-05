/**
 * apps/web/src/app/services/alert.service.spec.ts
 *
 * Unit tests for AlertService — real-time alert delivery over Socket.io.
 *
 * NOTE: AlertService does NOT use HttpClient (unlike the other API
 * services) — it opens a Socket.io client when `connect()` is called, so
 * the auth.service.spec.ts HttpClient-spy pattern does not apply here.
 * Instead AuthService is mocked (its `token()` gates whether a socket is
 * opened) and the socket's registered 'connect'/'disconnect'/'alert'
 * handlers are invoked directly via `socket.listeners(...)`, which
 * socket.io-client v4 exposes on its Socket object. This exercises the
 * real handler closures without needing to mock the `io` module.
 *
 * Each test that opens a socket calls `disconnect()` at the end so no
 * real connection attempt lingers after the test.
 */
import { TestBed } from '@angular/core/testing';
import type { Socket } from 'socket.io-client';
import { AlertService } from './alert.service';
import { AuthService } from './auth.service';
import type { AlertDispatchedPayload } from '@caregiver/contracts';

describe('AlertService', () => {
  /** Token returned by the mocked AuthService (null = logged out). */
  let tokenValue: string | null;
  // AuthService.token is a signal (a callable object), so the mock just needs
  // a callable `token` that returns the current tokenValue.
  const authMock = { token: () => tokenValue };

  const mockAlert: AlertDispatchedPayload = {
    alertId: 'alert-1',
    patientId: 'pat-1',
    alertType: 'vital_threshold',
    severity: 'critical',
    message: 'Heart rate 190 bpm',
    targetRoles: ['doctor', 'nurse'],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    tokenValue = null;
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authMock }],
    });
  });

  function createService(): AlertService {
    return TestBed.inject(AlertService);
  }

  /** Access the private socket handle for handler inspection. */
  function socketOf(service: AlertService): Socket | null {
    return (service as unknown as { socket: Socket | null }).socket;
  }

  /** Like socketOf, but throws when the socket is not open (for non-null use). */
  function requireSocket(service: AlertService): Socket {
    const socket = socketOf(service);
    if (!socket) {
      throw new Error('Expected an open socket, but AlertService.socket was null');
    }
    return socket;
  }

  it('does not open a socket when there is no token', () => {
    const service = createService();

    service.connect();

    expect(socketOf(service)).toBeNull();
    expect(service.connected()).toBe(false);
    expect(service.alerts()).toEqual([]);
  });

  it('opens a socket and registers an alert handler when a token exists', () => {
    tokenValue = 'token-1';
    const service = createService();

    service.connect();

    const socket = requireSocket(service);
    // Exactly one 'alert' handler is registered (no duplicates on re-run).
    expect(socket.listeners('alert').length).toBe(1);
    expect(service.connected()).toBe(false);
    service.disconnect();
  });

  it('sets connected true on the socket connect event and false on disconnect', () => {
    tokenValue = 'token-1';
    const service = createService();
    service.connect();
    const socket = requireSocket(service);

    socket.listeners('connect').forEach((fn: () => void) => fn());
    expect(service.connected()).toBe(true);

    socket.listeners('disconnect').forEach((fn: () => void) => fn());
    expect(service.connected()).toBe(false);
    service.disconnect();
  });

  it('prepends alert events to the alerts signal', () => {
    tokenValue = 'token-1';
    const service = createService();
    service.connect();
    const socket = requireSocket(service);

    socket
      .listeners('alert')
      .forEach((fn: (alert: AlertDispatchedPayload) => void) => fn(mockAlert));

    expect(service.alerts()).toEqual([mockAlert]);
    service.disconnect();
  });

  it('caps the alerts signal at 50 entries', () => {
    tokenValue = 'token-1';
    const service = createService();
    service.connect();
    const listener = requireSocket(service).listeners('alert')[0] as (
      alert: AlertDispatchedPayload,
    ) => void;

    for (let i = 0; i < 55; i++) {
      listener({ ...mockAlert, alertId: `alert-${i}` });
    }

    const alerts = service.alerts();
    expect(alerts.length).toBe(50);
    // The length assertion above pins the array size, so `?.` here only
    // satisfies noUncheckedIndexedAccess — the elements are always present.
    expect(alerts[0]?.alertId).toBe('alert-54');
    expect(alerts[49]?.alertId).toBe('alert-5');
    service.disconnect();
  });

  it('emits an acknowledgment and removes the alert from the list', () => {
    tokenValue = 'token-1';
    const service = createService();
    service.alerts.set([mockAlert]);
    service.connect();
    const socket = requireSocket(service);
    const emitSpy = spyOn(socket, 'emit');

    service.acknowledge('alert-1');

    expect(emitSpy).toHaveBeenCalledWith('alert:acknowledge', { alertId: 'alert-1' });
    expect(service.alerts()).toEqual([]);
    service.disconnect();
  });

  it('clears all alerts', () => {
    const service = createService();
    service.alerts.set([mockAlert, { ...mockAlert, alertId: 'alert-2' }]);

    service.clear();

    expect(service.alerts()).toEqual([]);
  });

  it('disconnects the socket and nulls the handle', () => {
    tokenValue = 'token-1';
    const service = createService();
    service.connect();
    const socket = requireSocket(service);
    const disconnectSpy = spyOn(socket, 'disconnect');

    service.disconnect();

    expect(disconnectSpy).toHaveBeenCalled();
    expect(socketOf(service)).toBeNull();
    expect(service.connected()).toBe(false);
  });
});
