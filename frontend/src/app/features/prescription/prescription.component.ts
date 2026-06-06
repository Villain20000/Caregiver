import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvAvatarComponent } from '../../shared/components/cv-avatar/cv-avatar.component';
import { CvModalComponent } from '../../shared/components/cv-modal/cv-modal.component';
import { CvSignaturePadComponent } from '../../shared/components/cv-signature-pad/cv-signature-pad.component';

import { PrescriptionService } from '../../core/services/prescription.service';
import { RxPatient, RxStatus } from '../../core/models/prescription.model';
import { Role } from '../../core/models/role.model';

@Component({
  selector: 'cv-prescription',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, FormsModule,
    CvCardComponent, CvButtonComponent, CvBadgeComponent, CvAvatarComponent,
    CvModalComponent, CvSignaturePadComponent,
  ],
  templateUrl: './prescription.component.html',
})
export class PrescriptionComponent {
  private readonly rxService = inject(PrescriptionService);
  readonly Role = Role;

  readonly patientId   = signal<string>(this.rxService.patients[0]?.id ?? '');
  readonly drug        = signal<string>('');
  readonly dose        = signal<string>('');
  readonly frequency   = signal<string>('Once daily');
  readonly duration    = signal<string>('30');
  readonly refills     = signal<number>(0);
  readonly notes       = signal<string>('');

  readonly frequencyOptions = [
    'Once daily', 'Twice daily', 'Three times daily', 'Every 4h', 'Every 6h',
    'Every 8h', 'Once nightly', 'PRN', 'Weekly',
  ];

  readonly drugSuggestions = computed<string[]>(() => {
    const q = this.drug().trim().toLowerCase();
    if (!q) return this.rxService.drugDb.slice(0, 6);
    return this.rxService.drugDb.filter((d) => d.toLowerCase().includes(q)).slice(0, 8);
  });

  readonly formValid = computed(() =>
    !!this.patientId() && !!this.drug().trim() && !!this.dose().trim() &&
    !!this.frequency() && !!this.duration() && this.refills() >= 0,
  );

  selectDrug(d: string): void { this.drug.set(d); }
  setRefills(n: number): void { this.refills.set(Math.max(0, n)); }
  patientNameOf(id: string): string { return this.rxService.patients.find((p) => p.id === id)?.name ?? 'Unknown'; }

  readonly patients: RxPatient[] = this.rxService.patients;
  readonly expiring = this.rxService.expiring;
  readonly history  = this.rxService.history;

  readonly signOpen  = signal(false);
  readonly signSig   = signal<string | null>(null);
  readonly signedRx  = signal<{ id: string; drug: string; dose: string; patientName: string } | null>(null);
  readonly sigError  = signal<string | null>(null);

  openSign(): void {
    if (!this.formValid()) return;
    this.signSig.set(null);
    this.sigError.set(null);
    this.signOpen.set(true);
  }
  closeSign(): void { this.signOpen.set(false); this.signedRx.set(null); }

  confirmSign(): void {
    if (!this.signSig()) { this.sigError.set('A signature is required to issue a prescription.'); return; }
    const patient = this.patients.find((p) => p.id === this.patientId());
    if (!patient) return;
    const rx = this.rxService.issue({
      patientId: patient.id,
      patientName: patient.name,
      drug: this.drug().trim(),
      dose: this.dose().trim(),
      frequency: this.frequency(),
      duration: this.duration() + ' days',
      refills: this.refills(),
      notes: this.notes().trim() || undefined,
    }, 'Dr. Alex Morgan');
    this.signedRx.set({ id: rx.id, drug: rx.drug, dose: rx.dose, patientName: rx.patientName });
  }

  acknowledgeIssued(): void {
    this.signOpen.set(false);
    this.signedRx.set(null);
    this.drug.set('');
    this.dose.set('');
    this.notes.set('');
    this.refills.set(0);
    this.duration.set('30');
    this.frequency.set('Once daily');
  }

  renew(id: string): void { this.rxService.renew(id); }

  statusTone(s: RxStatus): 'success' | 'warning' | 'neutral' | 'danger' {
    if (s === 'active')    return 'success';
    if (s === 'renewed')   return 'warning';
    if (s === 'cancelled') return 'danger';
    return 'neutral';
  }
  daysUntilExpiry(r: { expiresAt: number }): number {
    return Math.max(0, Math.round((r.expiresAt - Date.now()) / (24 * 3600_000)));
  }
  isExpiringSoon(r: { status: RxStatus; expiresAt: number }): boolean {
    return r.status === 'active' && this.daysUntilExpiry(r) <= 14;
  }
}
