import { Injectable, computed, signal } from '@angular/core';
import { ScheduleConflict, ShiftEvent } from '../models/schedule.model';
import { MockDataService } from './mock-data.service';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly _shifts = signal<ShiftEvent[]>([]);
  readonly shifts = this._shifts.asReadonly();

  readonly today = computed<ShiftEvent[]>(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date();   end.setHours(23, 59, 59, 999);
    return this._shifts().filter((s) => {
      const t = new Date(s.start).getTime();
      return t >= start.getTime() && t <= end.getTime();
    });
  });

  readonly upcoming = computed<ShiftEvent[]>(() => {
    const now = Date.now();
    return [...this._shifts()]
      .filter((s) => new Date(s.start).getTime() >= now - 60 * 60_000)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 12);
  });

  readonly conflicts = computed<ScheduleConflict[]>(() => {
    const list = this._shifts();
    const out: ScheduleConflict[] = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.userId !== b.userId) continue;
        const aS = new Date(a.start).getTime(), aE = new Date(a.end).getTime();
        const bS = new Date(b.start).getTime(), bE = new Date(b.end).getTime();
        const overlap = Math.max(0, Math.min(aE, bE) - Math.max(aS, bS));
        if (overlap > 0) {
          out.push({ shiftA: a, shiftB: b, overlapMinutes: Math.round(overlap / 60_000) });
        }
      }
    }
    return out;
  });

  readonly onCall = computed<ShiftEvent[]>(() => this._shifts().filter((s) => s.onCall));

  constructor(private readonly mock: MockDataService) {
    this._shifts.set(this.mock.schedule());
  }

  add(shift: Omit<ShiftEvent, 'id'>): ShiftEvent {
    const entry: ShiftEvent = { id: `sh-${Date.now()}`, ...shift };
    this._shifts.update((l) => [entry, ...l]);
    return entry;
  }

  updateStatus(id: string, status: ShiftEvent['status']): void {
    this._shifts.update((l) => l.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  cancel(id: string): void {
    this.updateStatus(id, 'cancelled');
  }
}
