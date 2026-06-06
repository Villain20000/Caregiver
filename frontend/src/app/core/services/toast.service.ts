import { Injectable, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  /** ms until auto-dismiss */
  duration: number;
}

const DEFAULT_DURATION = 4000;

/**
 * Lightweight toast queue. Components subscribe via <cv-toast-container>.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(message: string, tone: ToastTone = 'info', duration = DEFAULT_DURATION): number {
    const id = this.nextId++;
    const toast: Toast = { id, message, tone, duration };
    this._toasts.update((arr) => [...arr, toast]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
    return id;
  }

  success(message: string, duration?: number): number {
    return this.show(message, 'success', duration);
  }

  info(message: string, duration?: number): number {
    return this.show(message, 'info', duration);
  }

  warning(message: string, duration?: number): number {
    return this.show(message, 'warning', duration);
  }

  danger(message: string, duration?: number): number {
    return this.show(message, 'danger', duration);
  }

  dismiss(id: number): void {
    this._toasts.update((arr) => arr.filter((t) => t.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
  }
}
