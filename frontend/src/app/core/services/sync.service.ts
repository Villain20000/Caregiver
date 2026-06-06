import { Injectable, computed, signal } from '@angular/core';

export type SyncState = 'online' | 'syncing' | 'offline';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly _state = signal<SyncState>('online');
  private readonly _pending = signal<number>(0);
  private readonly _lastSync = signal<string>(new Date().toISOString());

  readonly state = this._state.asReadonly();
  readonly pendingChanges = this._pending.asReadonly();
  readonly lastSync = this._lastSync.asReadonly();

  readonly label = computed<string>(() => {
    const s = this._state();
    if (s === 'online') return 'All changes synced';
    if (s === 'syncing') return `Syncing ${this._pending()} change${this._pending() === 1 ? '' : 's'}…`;
    return `Offline · ${this._pending()} pending`;
  });

  /** Demo-only: cycle through states. */
  cycle(): void {
    const s = this._state();
    if (s === 'online') this._state.set('syncing');
    else if (s === 'syncing') {
      this._pending.set(0);
      this._lastSync.set(new Date().toISOString());
      this._state.set('online');
    } else {
      this._pending.set(Math.max(0, this._pending() - 1));
      if (this._pending() === 0) this._state.set('online');
    }
  }

  toggleOffline(): void {
    if (this._state() === 'offline') {
      this._state.set('online');
      this._pending.set(0);
    } else {
      this._state.set('offline');
      this._pending.set(3 + Math.floor(Math.random() * 5));
    }
  }

  enqueue(): void {
    this._pending.update((n) => n + 1);
  }
}
