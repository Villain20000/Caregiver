/**
 * apps/web/src/app/services/alert.service.ts
 *
 * Angular service for real-time alert delivery via Socket.io.
 *
 * 📝 Angular Concepts Demonstrated:
 *   - **@Injectable({ providedIn: 'root' })** — singleton service
 *   - **Signal** for reactive alert list (auto-updates UI)
 *   - **OnDestroy** lifecycle hook for cleanup
 *   - **Socket.io** client for WebSocket real-time communication
 *   - **Dependency injection** via inject()
 *
 * Flow:
 *   1. Auth service calls `connect()` after successful login
 *   2. Socket.io client authenticates with JWT from AuthService.token()
 *   3. Server sends 'alert' events → signal updates → UI re-renders
 *   4. User can acknowledge or clear alerts
 *   5. `disconnect()` on logout
 *
 * The alert signal is capped at 50 items to prevent memory leaks.
 */
import { Injectable, inject, signal, type OnDestroy } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import { AuthService } from './auth.service.js';
import type { AlertDispatchedPayload } from '@caregiver/contracts';

@Injectable({ providedIn: 'root' })
export class AlertService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private socket: Socket | null = null;

  readonly alerts = signal<AlertDispatchedPayload[]>([]);
  readonly connected = signal(false);

  connect(): void {
    if (this.socket?.connected) return;

    const token = this.authService.token();
    if (!token) return;

    this.socket = io('/', {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      this.connected.set(true);
    });

    this.socket.on('disconnect', () => {
      this.connected.set(false);
    });

    this.socket.on('alert', (alert: AlertDispatchedPayload) => {
      this.alerts.update((prev) => [alert, ...prev].slice(0, 50));
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }

  acknowledge(alertId: string): void {
    this.socket?.emit('alert:acknowledge', { alertId });
    this.alerts.update((prev) => prev.filter((a) => a.alertId !== alertId));
  }

  clear(): void {
    this.alerts.set([]);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
