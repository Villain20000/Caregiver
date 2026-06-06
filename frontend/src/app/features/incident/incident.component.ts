import {
  ChangeDetectionStrategy, Component, computed, inject, signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvAvatarComponent } from '../../shared/components/cv-avatar/cv-avatar.component';

import { IncidentService } from '../../core/services/incident.service';
import { AuthService } from '../../core/services/auth.service';
import { IncidentSeverity, IncidentKind, Incident } from '../../core/models/incident.model';
import { Role } from '../../core/models/role.model';

@Component({
  selector: 'cv-incident',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, DatePipe, FormsModule,
    CvCardComponent, CvButtonComponent, CvBadgeComponent, CvAvatarComponent,
  ],
  templateUrl: './incident.component.html',
})
export class IncidentComponent {
  private readonly incidents = inject(IncidentService);
  private readonly auth      = inject(AuthService);

  readonly Role = Role;

  /* ---------- form ---------- */
  readonly formType        = signal<IncidentKind>('fall');
  readonly formSeverity    = signal<IncidentSeverity>('med');
  readonly formDate        = signal<string>(this.nowLocal());
  readonly formLocation    = signal<string>('Room 204-B');
  readonly formWitnesses   = signal<string>('');
  readonly formDescription = signal<string>('');
  readonly formAction      = signal<string>('');

  readonly kindOptions: { value: IncidentKind; label: string; icon: string }[] = [
    { value: 'fall',          label: 'Fall',         icon: '🤕' },
    { value: 'med-error',     label: 'Med Error',    icon: '💊' },
    { value: 'equipment',     label: 'Equipment',    icon: '🔧' },
    { value: 'elopement',     label: 'Elopement',    icon: '🚪' },
    { value: 'skin-event',    label: 'Skin Event',   icon: '🩹' },
    { value: 'behavioral',    label: 'Behavioral',   icon: '🗣' },
    { value: 'communication', label: 'Communication',icon: '📞' },
    { value: 'other',         label: 'Other',        icon: '📋' },
  ];

  readonly severityOptions: { value: IncidentSeverity; label: string; description: string }[] = [
    { value: 'low',      label: '1',  description: 'Minor — no harm' },
    { value: 'med',      label: '2',  description: 'Moderate — first aid' },
    { value: 'high',     label: '3',  description: 'High — escalated care' },
    { value: 'critical', label: '4',  description: 'Critical — supervisor' },
    { value: 'critical', label: '5',  description: 'Catastrophic — leadership' },
  ];

  /** 1-5 visual radios that always map to distinct severities. */
  readonly severityRadios: { value: IncidentSeverity; label: string; description: string }[] = [
    { value: 'low',      label: '1', description: 'Minor — no harm' },
    { value: 'low',      label: '2', description: 'Mild — observation' },
    { value: 'med',      label: '3', description: 'Moderate — first aid' },
    { value: 'high',     label: '4', description: 'High — escalated care' },
    { value: 'critical', label: '5', description: 'Critical — supervisor' },
  ];

  readonly formValid = computed(() =>
    !!this.formDescription().trim() && !!this.formLocation().trim(),
  );

  /* ---------- submission result ---------- */
  readonly showBanner = signal(false);
  readonly bannerText = signal<string>('');
  private bannerTimer?: ReturnType<typeof setTimeout>;

  submit(): void {
    if (!this.formValid()) return;
    const user = this.auth.currentUser();
    const occurredAtIso = new Date(this.formDate()).toISOString();
    const sev = this.formSeverity();
    const sv = sev === 'low' ? 1 : sev === 'med' ? 2 : sev === 'high' ? 3 : 4;
    this.incidents.add({
      patientId: 'pat-1',
      kind: this.formType(),
      severity: sev,
      status: 'open',
      occurredAt: occurredAtIso,
      summary: this.formDescription().trim(),
      witnesses: this.formWitnesses().split(',').map((s) => s.trim()).filter(Boolean),
      correctiveActions: this.formAction().trim() ? [this.formAction().trim()] : [],
    });
    // Trigger supervisor banner for severity 4-5
    if (sv >= 4) {
      this.bannerText.set(`🚨 Supervisor notified — ${this.formType().toUpperCase()} incident (severity ${sv}) at ${this.formLocation()}`);
      this.showBanner.set(true);
      if (this.bannerTimer) clearTimeout(this.bannerTimer);
      this.bannerTimer = setTimeout(() => this.showBanner.set(false), 6000);
    }
    // Reset form
    this.formDescription.set('');
    this.formAction.set('');
    this.formWitnesses.set('');
    this.formSeverity.set('med');
    this.formType.set('fall');
  }

  /* ---------- list ---------- */
  readonly list = this.incidents.incidents;

  severityRank(s: IncidentSeverity): number {
    return s === 'low' ? 1 : s === 'med' ? 2 : s === 'high' ? 3 : 4;
  }
  severityLabel(s: IncidentSeverity): string {
    return s === 'low' ? 'Low' : s === 'med' ? 'Medium' : s === 'high' ? 'High' : 'Critical';
  }
  severityTone(s: IncidentSeverity): 'success' | 'warning' | 'danger' | 'primary' {
    return s === 'low' ? 'success' : s === 'med' ? 'warning' : s === 'high' ? 'danger' : 'danger';
  }
  kindIcon(k: IncidentKind): string {
    return this.kindOptions.find((o) => o.value === k)?.icon ?? '📋';
  }
  kindLabel(k: IncidentKind): string {
    return this.kindOptions.find((o) => o.value === k)?.label ?? k;
  }

  /* ---------- print ---------- */
  print(): void {
    if (typeof window !== 'undefined') window.print();
  }

  private nowLocal(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
