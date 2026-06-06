import { ChangeDetectionStrategy, Component, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS, Role } from '../../core/models/role.model';
import { DashboardFacadeService } from '../../core/services/dashboard-facade.service';
import { PatientService } from '../../core/services/patient.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

interface MatchCandidate {
  userId: string;
  name: string;
  role: Role;
  avatar: string;
  matchScore: number;
  languages: string[];
  distanceMiles: number;
  skills: string[];
}

const STORAGE_KEY_PREFIX = 'carevibe.matching.assigned.';

@Component({
  selector: 'cv-matching',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">hr matching</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
          <cv-badge tone="success">Patient: {{ currentPatientName() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Caregiver Compatibility Matcher
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Evaluate compatibility scores, calculate driving radiuses, and pair patients with matching clinicians.
        </p>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Main Panel: Match Candidates List -->
        <div class="lg:col-span-2 space-y-6">
          <cv-card title="Matching Caregiver Candidates" subtitle="Sorted by compatibility index">
            <div class="space-y-4">
              <div
                *ngFor="let cand of candidates"
                class="p-4 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850/10 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div class="flex items-start gap-3">
                  <div class="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-black flex items-center justify-center text-sm shrink-0">
                    {{ cand.avatar }}
                  </div>
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-snug">{{ cand.name }}</span>
                      <cv-badge tone="neutral">{{ getUserRoleLabel(cand.role) }}</cv-badge>
                      <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100/40 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">
                        {{ cand.matchScore }}% Match
                      </span>
                    </div>
                    
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                      Distance: {{ cand.distanceMiles }} miles away · Languages: {{ cand.languages.join(', ') }}
                    </p>
                    
                    <!-- Skills badges -->
                    <div class="flex flex-wrap gap-1 mt-2">
                      <span *ngFor="let s of cand.skills" class="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                        {{ s }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="shrink-0">
                  <cv-button
                    *ngIf="isPrivilegedRole() && assignedCaregiverId() !== cand.userId"
                    variant="primary"
                    size="sm"
                    (click)="assignCaregiver(cand)"
                  >
                    Assign Clinician
                  </cv-button>
                  
                  <span *ngIf="assignedCaregiverId() === cand.userId" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    ✓ Assigned Clinician
                  </span>
                </div>
              </div>
            </div>
          </cv-card>
        </div>

        <!-- Sidebar: Match Preferences & Current Assignment -->
        <div class="lg:col-span-1 space-y-6">
          <cv-card title="Active Pairing" subtitle="Assigned caregiver for this patient">
            <div class="space-y-4">
              <div *ngIf="assignedCaregiver(); else emptyAssignment" class="p-4 rounded-xl border border-slate-200/50 dark:border-slate-800 bg-emerald-50/20 text-center">
                <div class="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-black flex items-center justify-center text-sm mx-auto mb-2">
                  {{ assignedCaregiver()?.avatar }}
                </div>
                <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100 leading-snug">{{ assignedCaregiver()?.name }}</h4>
                <p class="text-[11px] text-slate-400 mt-0.5">{{ getUserRoleLabel(assignedCaregiver()!.role) }}</p>
                <p class="text-xs text-slate-600 dark:text-slate-350 mt-3 italic leading-relaxed">
                  "Successfully matched and assigned based on patient care specifications."
                </p>
                
                <cv-button
                  *ngIf="isPrivilegedRole()"
                  variant="ghost"
                  size="sm"
                  class="mt-4"
                  (click)="removeAssignment()"
                >
                  Unassign
                </cv-button>
              </div>

              <ng-template #emptyAssignment>
                <div class="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 py-6">
                  No caregiver currently assigned. Select a candidate from the match results.
                </div>
              </ng-template>
            </div>
          </cv-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class MatchingComponent {
  private readonly roleService = inject(RoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly facade = inject(DashboardFacadeService);
  private readonly patientService = inject(PatientService);
  private readonly toast = inject(ToastService);

  readonly assignedCaregiverId = signal<string | null>(null);
  readonly assignedCaregiver = signal<MatchCandidate | null>(null);

  // Context Computations
  readonly selectedPatientId = computed(() => this.facade.selectedPatientId());
  readonly currentPatientName = computed(() => {
    const id = this.selectedPatientId();
    return id ? this.patientService.byId(id)?.name : 'Unknown Patient';
  });

  readonly isPrivilegedRole = computed(() => {
    const r = this.roleService.activeRole();
    return r === Role.ADMIN || r === Role.SOCIAL_WORKER || r === Role.DISPATCHER;
  });

  readonly candidates: MatchCandidate[] = [
    { userId: 'u-nurse1', name: 'Maya Patel', role: Role.NURSE, avatar: 'MP', matchScore: 98, languages: ['English', 'Spanish'], distanceMiles: 1.2, skills: ['Wound Care', 'IV Infusion', 'Dementia Care'] },
    { userId: 'u-nurse2', name: 'Tomás Reyes', role: Role.NURSE, avatar: 'TR', matchScore: 88, languages: ['English', 'Portuguese'], distanceMiles: 3.5, skills: ['ADL Support', 'Vital Signs Check'] },
    { userId: 'u-ther1', name: 'Ines Costa', role: Role.THERAPIST, avatar: 'IC', matchScore: 82, languages: ['English'], distanceMiles: 2.1, skills: ['Post-Op Rehab', 'Core Stability'] },
  ];

  constructor() {
    effect(() => {
      const patId = this.selectedPatientId();
      if (patId) {
        const key = STORAGE_KEY_PREFIX + patId;
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            const data = JSON.parse(saved);
            this.assignedCaregiverId.set(data.userId);
            this.assignedCaregiver.set(data);
          } catch {
            this.removeAssignmentState();
          }
        } else {
          this.removeAssignmentState();
        }
      } else {
        this.removeAssignmentState();
      }
    }, { allowSignalWrites: true });
  }

  private removeAssignmentState(): void {
    this.assignedCaregiverId.set(null);
    this.assignedCaregiver.set(null);
  }

  assignCaregiver(cand: MatchCandidate): void {
    const patId = this.selectedPatientId();
    if (!patId) return;

    this.assignedCaregiverId.set(cand.userId);
    this.assignedCaregiver.set(cand);
    
    const key = STORAGE_KEY_PREFIX + patId;
    localStorage.setItem(key, JSON.stringify(cand));
    
    this.toast.success(`Caregiver ${cand.name} assigned successfully.`);
  }

  removeAssignment(): void {
    const patId = this.selectedPatientId();
    if (!patId) return;

    this.removeAssignmentState();
    localStorage.removeItem(STORAGE_KEY_PREFIX + patId);
    this.toast.success('Caregiver assignment removed.');
  }

  getUserRoleLabel(role: Role): string {
    return ROLE_LABELS[role];
  }

  roleLabel(): string {
    return ROLE_LABELS[this.roleService.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Matching';
  }
}
