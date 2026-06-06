import { Injectable, computed, signal } from '@angular/core';
import { VitalsReading, VitalsStats, VitalsFlag } from '../models/vitals.model';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class VitalsService {
  private readonly _readings = signal<VitalsReading[]>([]);
  readonly readings = this._readings.asReadonly();

  readonly latest = computed<VitalsReading | null>(() => {
    const r = this._readings();
    if (r.length === 0) return null;
    return [...r].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  });

  readonly stats = computed<VitalsStats>(() => {
    const r = this._readings();
    if (r.length === 0) {
      return { latest: null, avgHr: 0, avgSystolic: 0, avgDiastolic: 0, avgGlucose: 0, avgSpo2: 0, avgTemp: 0, criticalCount: 0, watchCount: 0 };
    }
    const sum = (key: keyof VitalsReading) => r.reduce((acc, x) => acc + (x[key] as number), 0);
    const flags = r.reduce<Record<VitalsFlag, number>>((acc, x) => { acc[x.flag]++; return acc; }, { normal: 0, watch: 0, critical: 0 });
    return {
      latest: this.latest(),
      avgHr: Math.round(sum('hr') / r.length),
      avgSystolic: Math.round(sum('systolic') / r.length),
      avgDiastolic: Math.round(sum('diastolic') / r.length),
      avgGlucose: Math.round(sum('glucose') / r.length),
      avgSpo2: Math.round(sum('spo2') / r.length),
      avgTemp: Math.round((sum('temp') / r.length) * 10) / 10,
      criticalCount: flags.critical,
      watchCount: flags.watch,
    };
  });

  readonly byPatient = computed<Record<string, VitalsReading[]>>(() => {
    const out: Record<string, VitalsReading[]> = {};
    for (const r of this._readings()) {
      (out[r.patientId] ??= []).push(r);
    }
    return out;
  });

  constructor(private readonly http: HttpClient) {
    this.load();
  }

  load(): void {
    this.http.get<VitalsReading[]>(`${API_BASE_URL}/vitals`).subscribe({
      next: (data) => this._readings.set(data),
      error: (err) => console.error('Failed to load vitals', err),
    });
  }

  add(reading: Omit<VitalsReading, 'id' | 'flag'>): VitalsReading {
    const flag: VitalsFlag =
      reading.hr > 110 || reading.hr < 50 || reading.systolic > 160 || reading.systolic < 90 || reading.spo2 < 92 || reading.temp > 100.4
        ? 'critical'
        : reading.hr > 95 || reading.systolic > 145 || reading.spo2 < 95 || reading.glucose > 180
          ? 'watch'
          : 'normal';
    const tempId = `vtl-${Date.now()}`;
    const entry: VitalsReading = { id: tempId, flag, ...reading };

    // Optimistic Update
    this._readings.update((list) => [entry, ...list]);

    this.http.post<VitalsReading>(`${API_BASE_URL}/vitals`, reading).subscribe({
      next: (saved) => {
        this._readings.update((list) => list.map(item => item.id === tempId ? saved : item));
      },
      error: (err) => {
        console.error('Failed to add vital', err);
        // Rollback
        this._readings.update((list) => list.filter(item => item.id !== tempId));
      }
    });

    return entry;
  }

  addNote(id: string, note: string): void {
    this._readings.update((list) =>
      list.map((v) => (v.id === id ? { ...v, note } : v))
    );
  }
}
