import { Injectable, signal, computed } from '@angular/core';
import { Prescription, RxStatus } from '../models';

const DRUG_DB = [
  'Lisinopril 10 mg', 'Metformin 500 mg', 'Atorvastatin 20 mg', 'Amoxicillin 500 mg',
  'Levothyroxine 50 mcg', 'Albuterol HFA', 'Hydrochlorothiazide 25 mg', 'Sertraline 50 mg',
  'Warfarin 5 mg', 'Insulin Glargine 100u/mL', 'Ibuprofen 400 mg', 'Acetaminophen 650 mg',
  'Omeprazole 20 mg', 'Gabapentin 300 mg', 'Ciprofloxacin 500 mg',
];

const PATIENTS = [
  { id: 'p-101', name: 'Eleanor R. Hayes' },
  { id: 'p-102', name: 'Marcus T. Lee' },
  { id: 'p-103', name: 'Priya S. Patel' },
  { id: 'p-104', name: 'James K. O\u2019Connor' },
  { id: 'p-105', name: 'Sofia A. Rivera' },
];

@Injectable({ providedIn: 'root' })
export class PrescriptionService {
  readonly drugDb = DRUG_DB;
  readonly patients = PATIENTS;

  private readonly _rx = signal<Prescription[]>(this.seed());
  readonly rx = this._rx.asReadonly();

  readonly expiring = computed<Prescription[]>(() => {
    const now = Date.now();
    return this._rx()
      .filter((r) => r.status === 'active' && r.expiresAt - now < 14 * 24 * 3600_000)
      .sort((a, b) => a.expiresAt - b.expiresAt);
  });

  readonly history = computed<Prescription[]>(() =>
    [...this._rx()].sort((a, b) => b.issuedAt - a.issuedAt),
  );

  issue(p: Omit<Prescription, 'id' | 'status' | 'issuedAt' | 'expiresAt' | 'signedBy'>, signedBy: string): Prescription {
    const issuedAt = Date.now();
    const durationDays = parseInt(p['duration'], 10) || 30;
    const rx: Prescription = {
      ...p,
      id: 'rx-' + Math.random().toString(36).slice(2, 9),
      status: 'active',
      issuedAt,
      expiresAt: issuedAt + durationDays * 24 * 3600_000,
      signedBy,
    };
    this._rx.update((list) => [rx, ...list]);
    return rx;
  }

  renew(id: string): void {
    this._rx.update((list) => list.map((r) => {
      if (r.id !== id) return r;
      const issuedAt = Date.now();
      const days = Math.max(1, Math.round((r.expiresAt - r.issuedAt) / (24 * 3600_000)));
      return {
        ...r,
        status: 'renewed',
        // Add a new active entry to replace it:
        ...{ _shadow: true },
      } as Prescription;
    }));
    // For simplicity we just add a fresh active row.
    const old = this._rx().find((r) => r.id === id);
    if (old) {
      const issuedAt = Date.now();
      const days = Math.max(1, Math.round((old.expiresAt - old.issuedAt) / (24 * 3600_000)));
      const fresh: Prescription = {
        ...old,
        id: 'rx-' + Math.random().toString(36).slice(2, 9),
        status: 'active',
        issuedAt,
        expiresAt: issuedAt + days * 24 * 3600_000,
      };
      this._rx.update((list) => [fresh, ...list]);
    }
  }

  setStatus(id: string, status: RxStatus): void {
    this._rx.update((list) => list.map((r) => r.id === id ? { ...r, status } : r));
  }

  /* ---------------- seed ---------------- */

  private seed(): Prescription[] {
    const now = Date.now();
    const day = 24 * 3600_000;
    return [
      this.makeRx(0, 'p-101', 'Eleanor R. Hayes', 'Lisinopril 10 mg', '10 mg', 'Once daily', 30, 2, now - 25 * day, 5, 'active'),
      this.makeRx(1, 'p-102', 'Marcus T. Lee', 'Atorvastatin 20 mg', '20 mg', 'Once nightly', 90, 3, now - 80 * day, 10, 'active'),
      this.makeRx(2, 'p-103', 'Priya S. Patel', 'Metformin 500 mg', '500 mg', 'Twice daily', 30, 5, now - 28 * day, 2, 'active'),
      this.makeRx(3, 'p-104', 'James K. O\u2019Connor', 'Warfarin 5 mg', '5 mg', 'Once daily', 30, 0, now - 26 * day, 4, 'active'),
      this.makeRx(4, 'p-101', 'Eleanor R. Hayes', 'Acetaminophen 650 mg', '650 mg', 'Every 6h PRN', 14, 0, now - 60 * day, -25, 'expired'),
      this.makeRx(5, 'p-105', 'Sofia A. Rivera', 'Sertraline 50 mg', '50 mg', 'Once daily', 60, 1, now - 50 * day, 12, 'renewed'),
    ];
  }

  private makeRx(i: number, patientId: string, patientName: string, drug: string, dose: string, freq: string, dur: number, refills: number, issuedAt: number, expiresInDays: number, status: RxStatus): Prescription {
    return {
      id: 'rx-seed-' + i,
      patientId,
      patientName,
      drug,
      dose,
      frequency: freq,
      duration: dur + ' days',
      refills,
      status,
      issuedAt,
      expiresAt: issuedAt + expiresInDays * 24 * 3600_000,
      signedBy: 'Dr. Alex Morgan',
    };
  }
}
