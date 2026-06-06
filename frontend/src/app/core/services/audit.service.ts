import { Injectable, computed, signal } from '@angular/core';
import { AuditAction, AuditEntry } from '../models/audit.model';
import { MockDataService } from './mock-data.service';

let counter = 1000;

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly _entries = signal<AuditEntry[]>([]);

  readonly entries = this._entries.asReadonly();
  readonly count = computed(() => this._entries().length);
  readonly recent = computed(() => this._entries().slice(0, 25));

  constructor(private readonly mock: MockDataService) {
    this._entries.set(this.mock.auditEntries());
  }

  log(
    action: AuditAction,
    user: { id: string; name: string },
    resource: string,
    meta?: Record<string, string | number | boolean | null>,
  ): AuditEntry {
    const entry: AuditEntry = {
      id: `aud-${++counter}`,
      ts: new Date().toISOString(),
      action,
      userId: user.id,
      userName: user.name,
      resource,
      meta,
      ip: '10.0.0.' + Math.floor(Math.random() * 250 + 1),
    };
    this._entries.update((list) => [entry, ...list]);
    return entry;
  }

  clear(): void {
    this._entries.set([]);
  }
}
