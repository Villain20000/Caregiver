import { Injectable, computed, signal } from '@angular/core';
import { Medication, MedAdministration, MedRisk } from '../models/medication.model';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api.config';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';

@Injectable({ providedIn: 'root' })
export class MedicationService {
  private readonly _meds = signal<Medication[]>([]);
  private readonly _log = signal<MedAdministration[]>([]);
  readonly medications = this._meds.asReadonly();
  readonly log = this._log.asReadonly();

  readonly upcoming = computed<Medication[]>(() => {
    return [...this._meds()]
      .filter((m) => m.times.some((t) => new Date(t).getTime() > Date.now() - 60 * 60_000))
      .sort((a, b) => (a.times[0] ?? '').localeCompare(b.times[0] ?? ''));
  });

  readonly controlled = computed<Medication[]>(() => this._meds().filter((m) => m.riskLevel === 'controlled' || m.riskLevel === 'high'));
  readonly lowRefills = computed<Medication[]>(() => this._meds().filter((m) => m.refillsRemaining <= 1));

  readonly byRisk = computed<Record<MedRisk, Medication[]>>(() => {
    const out: Record<MedRisk, Medication[]> = { low: [], moderate: [], high: [], controlled: [] };
    for (const m of this._meds()) out[m.riskLevel].push(m);
    return out;
  });

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {
    this.load();
  }

  load(): void {
    this.http.get<Medication[]>(`${API_BASE_URL}/medications`).subscribe({
      next: (data) => this._meds.set(data),
      error: (err) => console.error('Failed to load medications', err),
    });
    this.http.get<MedAdministration[]>(`${API_BASE_URL}/med-administrations`).subscribe({
      next: (data) => this._log.set(data),
      error: (err) => console.error('Failed to load med administrations', err),
    });
  }

  markGiven(medicationId: string, verifiedBy?: string): MedAdministration | null {
    const med = this._meds().find((m) => m.id === medicationId);
    if (!med) return null;
    const user = this.auth.currentUser();
    if (med.doubleVerify && !verifiedBy) {
      throw new Error('Double-verify required for this medication');
    }

    const payload = {
      givenBy: user.id,
      verifiedBy,
      patientId: med.patientId
    };

    const tempId = `adm-${Date.now()}`;
    const admin: MedAdministration = {
      id: tempId,
      medicationId,
      patientId: med.patientId,
      givenAt: new Date().toISOString(),
      givenBy: user.id,
      verifiedBy,
    };

    // Optimistic Update
    this._log.update((l) => [admin, ...l]);
    this._meds.update((list) =>
      list.map((m) => (m.id === medicationId ? { ...m, lastGiven: admin.givenAt, lastGivenBy: user.id, refillsRemaining: Math.max(0, m.refillsRemaining - 1) } : m)),
    );

    this.http.post<MedAdministration>(`${API_BASE_URL}/medications/${medicationId}/administer`, payload).subscribe({
      next: (saved) => {
        this._log.update((l) => l.map(x => x.id === tempId ? saved : x));
        // Refresh meds from backend
        this.http.get<Medication[]>(`${API_BASE_URL}/medications`).subscribe((data) => this._meds.set(data));
      },
      error: (err) => {
        console.error('Failed to administer medication', err);
        // Rollback
        this._log.update((l) => l.filter(x => x.id !== tempId));
        this.http.get<Medication[]>(`${API_BASE_URL}/medications`).subscribe((data) => this._meds.set(data));
      }
    });

    this.audit.log('update', { id: user.id, name: user.name }, `medication:${medicationId}`, { dose: med.dose, doubleVerified: !!verifiedBy });
    return admin;
  }

  skip(medicationId: string, reason: string): void {
    const med = this._meds().find((m) => m.id === medicationId);
    if (!med) return;
    const user = this.auth.currentUser();

    const payload = {
      givenBy: user.id,
      patientId: med.patientId,
      skipped: true,
      reason
    };

    const tempId = `adm-${Date.now()}`;
    const admin: MedAdministration = {
      id: tempId,
      medicationId,
      patientId: med.patientId,
      givenAt: new Date().toISOString(),
      givenBy: user.id,
      skipped: true,
      reason,
    };

    // Optimistic Update
    this._log.update((l) => [admin, ...l]);

    this.http.post<MedAdministration>(`${API_BASE_URL}/medications/${medicationId}/administer`, payload).subscribe({
      next: (saved) => {
        this._log.update((l) => l.map(x => x.id === tempId ? saved : x));
      },
      error: (err) => {
        console.error('Failed to skip medication', err);
        // Rollback
        this._log.update((l) => l.filter(x => x.id !== tempId));
      }
    });

    this.audit.log('update', { id: user.id, name: user.name }, `medication:${medicationId}`, { skipped: true, reason });
  }
}
