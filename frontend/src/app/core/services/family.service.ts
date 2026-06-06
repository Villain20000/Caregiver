import { Injectable, computed, signal } from '@angular/core';
import { MockDataService } from './mock-data.service';

export interface FamilyUpdate {
  id: string;
  patientId: string;
  ts: string;
  author: string;
  mood: 'great' | 'okay' | 'low';
  note: string;
  photo?: string;
}

@Injectable({ providedIn: 'root' })
export class FamilyService {
  private readonly _updates = signal<FamilyUpdate[]>([]);
  readonly updates = this._updates.asReadonly();

  constructor(private readonly mock: MockDataService) {
    this._updates.set(this.mock.familyUpdates());
  }

  forPatient(patientId: string): FamilyUpdate[] {
    return this._updates().filter((u) => u.patientId === patientId);
  }

  readonly latestByPatient = computed<Record<string, FamilyUpdate>>(() => {
    const out: Record<string, FamilyUpdate> = {};
    for (const u of this._updates()) {
      if (!out[u.patientId] || out[u.patientId].ts < u.ts) out[u.patientId] = u;
    }
    return out;
  });
}
