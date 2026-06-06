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

import { MedicationService } from '../../core/services/medication.service';
import { AuthService } from '../../core/services/auth.service';
import { Medication, MedRisk } from '../../core/models/medication.model';
import { Role } from '../../core/models/role.model';

type Tab = 'today' | 'week' | 'all';
type RiskFilter = 'all' | 'low' | 'moderate' | 'high' | 'controlled';

interface SlotRow {
  medication: Medication;
  time: string;
  status: 'given' | 'pending' | 'missed' | 'double-verify';
  timestamp?: string;
  note?: string;
}

@Component({
  selector: 'cv-medication',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, FormsModule,
    CvCardComponent, CvButtonComponent, CvBadgeComponent, CvAvatarComponent,
    CvModalComponent, CvSignaturePadComponent,
  ],
  templateUrl: './medication.component.html',
})
export class MedicationComponent {
  private readonly meds = inject(MedicationService);
  private readonly auth  = inject(AuthService);
  readonly Role = Role;

  readonly tabs: { key: Tab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week',  label: 'This Week' },
    { key: 'all',   label: 'All' },
  ];
  readonly tab = signal<Tab>('today');

  readonly riskOptions: { value: RiskFilter; label: string }[] = [
    { value: 'all',        label: 'All' },
    { value: 'low',        label: 'Low' },
    { value: 'moderate',   label: 'Moderate' },
    { value: 'high',       label: 'High' },
    { value: 'controlled', label: 'Controlled' },
  ];
  readonly risk = signal<RiskFilter>('all');

  readonly rows = computed<SlotRow[]>(() => {
    const meds = this.meds.medications();
    const log  = this.meds.log();
    const days = this.tab() === 'today' ? 1 : this.tab() === 'week' ? 7 : 14;
    const rows: SlotRow[] = [];

    for (let d = 0; d < days; d++) {
      const day = new Date();
      day.setDate(day.getDate() - d);
      const dayKey = day.toISOString().slice(0, 10);

      for (const m of meds) {
        for (const t of m.times) {
          const tt = new Date(t);
          const hh = String(tt.getHours()).padStart(2, '0');
          const mm = String(tt.getMinutes()).padStart(2, '0');
          const time = `${hh}:${mm}`;

          const admin = log.find((a) => a.medicationId === m.id && a.givenAt.startsWith(dayKey) && !a.skipped);
          const skipped = log.find((a) => a.medicationId === m.id && a.givenAt.startsWith(dayKey) && a.skipped);

          let status: SlotRow['status'];
          if (admin) {
            status = m.doubleVerify && !admin.verifiedBy ? 'double-verify' : 'given';
          } else if (skipped) {
            status = 'missed';
          } else if (tt.getTime() < Date.now()) {
            status = m.doubleVerify ? 'double-verify' : 'pending';
          } else {
            status = 'pending';
          }

          rows.push({
            medication: m, time, status,
            timestamp: admin?.givenAt ?? skipped?.givenAt,
            note: skipped?.reason,
          });
        }
      }
    }
    return rows.sort((a, b) => {
      if (a.timestamp && b.timestamp) return b.timestamp.localeCompare(a.timestamp);
      if (a.timestamp) return -1;
      if (b.timestamp) return 1;
      return 0;
    });
  });

  readonly filtered = computed<SlotRow[]>(() => {
    const r = this.risk();
    if (r === 'all') return this.rows();
    return this.rows().filter((row) => row.medication.riskLevel === r);
  });

  readonly counts = computed(() => {
    const list = this.filtered();
    return {
      given:   list.filter((r) => r.status === 'given').length,
      pending: list.filter((r) => r.status === 'pending').length,
      missed:  list.filter((r) => r.status === 'missed').length,
      verify:  list.filter((r) => r.status === 'double-verify').length,
    };
  });

  readonly verifyOpen = signal(false);
  readonly activeRow  = signal<SlotRow | null>(null);
  readonly sig1       = signal<string | null>(null);
  readonly sig2       = signal<string | null>(null);
  nurse1Model = '';
  nurse2Model = '';
  readonly verifyError = signal<string | null>(null);

  setTab(t: Tab): void { this.tab.set(t); }
  setRisk(r: RiskFilter): void { this.risk.set(r); }

  tabClass(t: Tab): string {
    return t === this.tab()
      ? 'bg-white dark:bg-slate-800 shadow text-indigo-700 dark:text-indigo-300'
      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100';
  }
  riskBtnClass(r: RiskFilter): string {
    return r === this.risk()
      ? 'bg-indigo-600 text-white border-indigo-600'
      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700';
  }
  rowClass(r: MedRisk): string {
    const map: Record<MedRisk, string> = {
      low:        'bg-emerald-50/40 hover:bg-emerald-50/70 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10',
      moderate:   'bg-amber-50/40 hover:bg-amber-50/70 dark:bg-amber-500/5 dark:hover:bg-amber-500/10',
      high:       'bg-rose-50/40 hover:bg-rose-50/70 dark:bg-rose-500/5 dark:hover:bg-rose-500/10',
      controlled: 'bg-violet-50/40 hover:bg-violet-50/70 dark:bg-violet-500/5 dark:hover:bg-violet-500/10',
    };
    return map[r];
  }
  riskDotClass(r: MedRisk): string {
    switch (r) {
      case 'high':       return 'bg-rose-500';
      case 'moderate':   return 'bg-amber-500';
      case 'low':        return 'bg-emerald-500';
      case 'controlled': return 'bg-violet-500';
    }
  }
  riskTone(r: MedRisk): 'success' | 'warning' | 'danger' | 'primary' {
    switch (r) {
      case 'high':       return 'danger';
      case 'moderate':   return 'warning';
      case 'low':        return 'success';
      case 'controlled': return 'primary';
    }
  }
  statusTone(s: SlotRow['status']): 'success' | 'warning' | 'danger' | 'primary' {
    switch (s) {
      case 'given':         return 'success';
      case 'pending':       return 'warning';
      case 'missed':        return 'danger';
      case 'double-verify': return 'primary';
    }
  }
  statusLabel(s: SlotRow['status']): string {
    return s === 'double-verify' ? 'Double-Verify' : s.charAt(0).toUpperCase() + s.slice(1);
  }
  onCellClick(row: SlotRow): void {
    if (row.status === 'given') return;
    if (row.medication.doubleVerify || row.medication.riskLevel === 'controlled') {
      this.openVerify(row);
    } else {
      this.meds.markGiven(row.medication.id);
    }
  }
  openVerify(row: SlotRow): void {
    this.activeRow.set(row);
    this.verifyError.set(null);
    this.sig1.set(null);
    this.sig2.set(null);
    this.nurse1Model = '';
    this.nurse2Model = '';
    this.verifyOpen.set(true);
  }
  closeVerify(): void {
    this.verifyOpen.set(false);
    this.activeRow.set(null);
  }
  confirmDoubleVerify(): void {
    if (!this.sig1() || !this.sig2() || !this.nurse1Model.trim() || !this.nurse2Model.trim()) {
      this.verifyError.set('Both signatures and names are required.');
      return;
    }
    if (this.nurse1Model.trim().toLowerCase() === this.nurse2Model.trim().toLowerCase()) {
      this.verifyError.set('Two different nurses are required for verification.');
      return;
    }
    const row = this.activeRow();
    if (!row) return;
    try {
      this.meds.markGiven(row.medication.id, this.nurse2Model.trim());
    } catch {
      this.verifyError.set('Could not record administration.');
      return;
    }
    this.closeVerify();
  }
  patientName(): string { return 'Eleanor R. Hayes'; }
  patientMeta(): string { return '78y · Room 204-B · MRN-8421'; }
  isNurse(): boolean { return this.auth.currentUser().role === Role.NURSE; }
}
