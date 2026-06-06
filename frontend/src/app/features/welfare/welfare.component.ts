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
import { ToastService } from '../../core/services/toast.service';

interface WizardData {
  age: number;
  householdSize: number;
  monthlyIncome: number;
  disabilityHelp: boolean;
  needsFoodAssistance: boolean;
  hasChronicCondition: boolean;
}

const STORAGE_KEY_PREFIX = 'carevibe.welfare.wizard.';

@Component({
  selector: 'cv-welfare',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">welfare</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
          <cv-badge tone="success">Patient: {{ currentPatientName() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Social Welfare Eligibility Wizard
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Evaluate public benefits, food assistance, utility grants, and home-care waiver programs.
        </p>
      </header>

      <!-- Step Indicator Stepper -->
      <div class="flex items-center justify-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
        <div *ngFor="let s of [1, 2, 3, 4]" class="flex items-center">
          <div
            class="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
            [ngClass]="{
              'bg-indigo-600 text-white': currentStep() === s,
              'bg-emerald-500 text-white': currentStep() > s,
              'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400': currentStep() < s
            }"
          >
            {{ s < currentStep() ? '✓' : s }}
          </div>
          <span *ngIf="s < 4" class="w-12 h-0.5 bg-slate-200 dark:bg-slate-700 mx-2"
                [ngClass]="{ 'bg-emerald-500': currentStep() > s }"></span>
        </div>
      </div>

      <div class="max-w-3xl mx-auto w-full">
        <!-- Step 1: Financial and Demographics -->
        <cv-card *ngIf="currentStep() === 1" title="Step 1: Household & Financials" subtitle="Let's establish the financial baselines">
          <div class="space-y-4 py-2">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Age of Applicant</label>
                <input
                  type="number"
                  [(ngModel)]="wizardData.age"
                  min="0"
                  max="120"
                  class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Household Size</label>
                <input
                  type="number"
                  [(ngModel)]="wizardData.householdSize"
                  min="1"
                  max="20"
                  class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Estimated Monthly Income ($)</label>
              <input
                type="number"
                [(ngModel)]="wizardData.monthlyIncome"
                min="0"
                class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p class="text-[10px] text-slate-400 mt-1">Include all earned income, social security, and disability payments.</p>
            </div>

            <div class="flex justify-end pt-4">
              <cv-button variant="primary" (click)="nextStep()">
                Continue
              </cv-button>
            </div>
          </div>
        </cv-card>

        <!-- Step 2: Health & Functional Needs -->
        <cv-card *ngIf="currentStep() === 2" title="Step 2: Functional Assessments" subtitle="Assessing daily helper requirements">
          <div class="space-y-4 py-2">
            <div class="space-y-3">
              <label class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  [(ngModel)]="wizardData.disabilityHelp"
                  class="mt-1 accent-indigo-600 h-4 w-4 shrink-0"
                />
                <div>
                  <span class="block text-sm font-semibold text-slate-800 dark:text-slate-200">ADL Support Need</span>
                  <span class="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">Does the applicant require direct assistance with daily activities (eating, bathing, transferring)?</span>
                </div>
              </label>

              <label class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  [(ngModel)]="wizardData.hasChronicCondition"
                  class="mt-1 accent-indigo-600 h-4 w-4 shrink-0"
                />
                <div>
                  <span class="block text-sm font-semibold text-slate-800 dark:text-slate-200">Chronic Illness or Permanent Disability</span>
                  <span class="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">Diagnosed clinical condition likely to persist for 12 months or longer.</span>
                </div>
              </label>
            </div>

            <div class="flex justify-between pt-4">
              <cv-button variant="ghost" (click)="prevStep()">Back</cv-button>
              <cv-button variant="primary" (click)="nextStep()">Continue</cv-button>
            </div>
          </div>
        </cv-card>

        <!-- Step 3: Targeted Assistance Priorities -->
        <cv-card *ngIf="currentStep() === 3" title="Step 3: Service Programs Interest" subtitle="Specify other aid programs to screen">
          <div class="space-y-4 py-2">
            <div class="space-y-3">
              <label class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  [(ngModel)]="wizardData.needsFoodAssistance"
                  class="mt-1 accent-indigo-600 h-4 w-4 shrink-0"
                />
                <div>
                  <span class="block text-sm font-semibold text-slate-800 dark:text-slate-200">Nutritional Support</span>
                  <span class="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">Screen for SNAP benefits or local meals-on-wheels programs.</span>
                </div>
              </label>
            </div>

            <div class="flex justify-between pt-4">
              <cv-button variant="ghost" (click)="prevStep()">Back</cv-button>
              <cv-button variant="primary" (click)="evaluateEligibility()">Calculate Eligibility</cv-button>
            </div>
          </div>
        </cv-card>

        <!-- Step 4: Results Panel -->
        <cv-card *ngIf="currentStep() === 4" title="Screening Results" subtitle="Programs evaluation outcome">
          <div class="space-y-6 py-2">
            
            <!-- Simplified view for Patient/Family -->
            <div *ngIf="!isStaffRole(); else staffDetailedView" class="space-y-4">
              <div class="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl">
                <h3 class="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <span>🎉</span> Likely Eligible Programs
                </h3>
                <ul class="mt-3 space-y-2 text-sm text-emerald-900 dark:text-emerald-100 list-disc pl-5">
                  <li *ngIf="eligibleForMedicaidWaiver()">
                    <strong>Medicaid Home & Community-Based Waiver</strong>
                    <p class="text-xs text-emerald-600 dark:text-emerald-400/80 mt-0.5">Covers in-home caregiver hours, nurse visits, and therapist sessions.</p>
                  </li>
                  <li *ngIf="eligibleForSnap()">
                    <strong>SNAP (Food Stamps)</strong>
                    <p class="text-xs text-emerald-600 dark:text-emerald-400/80 mt-0.5">Monthly food stipend based on low-income bracket.</p>
                  </li>
                  <li *ngIf="eligibleForMsp()">
                    <strong>Medicare Savings Program (MSP)</strong>
                    <p class="text-xs text-emerald-600 dark:text-emerald-400/80 mt-0.5">Helps pay Medicare premiums and copays.</p>
                  </li>
                  <li *ngIf="!eligibleForMedicaidWaiver() && !eligibleForSnap() && !eligibleForMsp()">
                    <strong>General Community Support & Grants</strong>
                    <p class="text-xs text-emerald-600 dark:text-emerald-400/80 mt-0.5">Check for local charity housing grants or medication discounts.</p>
                  </li>
                </ul>
              </div>

              <!-- Next Steps -->
              <div class="p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                <h4 class="font-semibold text-slate-800 dark:text-slate-100 text-sm mb-2">Next Recommended Steps</h4>
                <ol class="space-y-2 text-xs text-slate-600 dark:text-slate-300 list-decimal pl-4">
                  <li>Schedule a intake meeting with your assigned Social Worker.</li>
                  <li>Gather 3 months of bank statements and proof of identity.</li>
                  <li>Submit the HCBS Application form (available in notice board).</li>
                </ol>
              </div>
            </div>

            <!-- Detailed Technical view for Staff -->
            <ng-template #staffDetailedView>
              <div class="space-y-4">
                <div class="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl space-y-3">
                  <h3 class="font-bold text-indigo-800 dark:text-indigo-300 text-sm">Staff Audit & Verification Metrics</h3>
                  
                  <div class="grid grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
                    <div>FPL Guideline limit: <span class="font-bold text-slate-800 dark:text-slate-100">\${{ getFplThreshold() }}/mo</span></div>
                    <div>Actual Income: <span class="font-bold text-slate-800 dark:text-slate-100">\${{ wizardData.monthlyIncome }}/mo</span></div>
                    <div>Income to FPL Ratio: <span class="font-bold" [ngClass]="getFplRatio() <= 100 ? 'text-emerald-500' : 'text-rose-500'">{{ getFplRatio() | number:'1.0-0' }}%</span></div>
                    <div>Functional Assessment Points: <span class="font-bold text-slate-800 dark:text-slate-100">{{ wizardData.disabilityHelp ? '1/1 ADL Need' : '0/1 ADL Need' }}</span></div>
                  </div>
                </div>

                <div class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
                  <table class="w-full text-left border-collapse">
                    <thead>
                      <tr class="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        <th class="p-3">Program Code</th>
                        <th class="p-3">Calculation Status</th>
                        <th class="p-3 text-right">Probability</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      <tr>
                        <td class="p-3 font-mono">MCAID-HCBS-WVR</td>
                        <td class="p-3">
                          <cv-badge [tone]="eligibleForMedicaidWaiver() ? 'success' : 'danger'">
                            {{ eligibleForMedicaidWaiver() ? 'Passes Criteria' : 'Fails Income/ADL' }}
                          </cv-badge>
                        </td>
                        <td class="p-3 text-right font-bold">{{ eligibleForMedicaidWaiver() ? '95%' : '0%' }}</td>
                      </tr>
                      <tr>
                        <td class="p-3 font-mono">SNAP-FSTAMP</td>
                        <td class="p-3">
                          <cv-badge [tone]="eligibleForSnap() ? 'success' : 'danger'">
                            {{ eligibleForSnap() ? 'Passes FPL' : 'Exceeds income' }}
                          </cv-badge>
                        </td>
                        <td class="p-3 text-right font-bold">{{ eligibleForSnap() ? '85%' : '5%' }}</td>
                      </tr>
                      <tr>
                        <td class="p-3 font-mono">MCARE-MSP-SLMB</td>
                        <td class="p-3">
                          <cv-badge [tone]="eligibleForMsp() ? 'success' : 'danger'">
                            {{ eligibleForMsp() ? 'Passes Age & FPL' : 'Fails criteria' }}
                          </cv-badge>
                        </td>
                        <td class="p-3 text-right font-bold">{{ eligibleForMsp() ? '90%' : '0%' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </ng-template>

            <div class="flex justify-between pt-4">
              <cv-button variant="ghost" (click)="resetWizard()">Reset Wizard</cv-button>
              <p class="text-xs text-slate-400 self-center">Screened as {{ roleLabel() }}</p>
            </div>
          </div>
        </cv-card>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class WelfareComponent {
  private readonly roleService = inject(RoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly facade = inject(DashboardFacadeService);
  private readonly patientService = inject(PatientService);
  private readonly toastService = inject(ToastService);

  // Selected Patient context
  readonly selectedPatientId = computed(() => this.facade.selectedPatientId());
  readonly currentPatientName = computed(() => {
    const id = this.selectedPatientId();
    return id ? this.patientService.byId(id)?.name : 'Unknown Patient';
  });

  readonly isStaffRole = computed(() => {
    const role = this.roleService.activeRole();
    return role === Role.SOCIAL_WORKER || role === Role.ADMIN || role === Role.NURSE || role === Role.DOCTOR;
  });

  // Wizard state
  readonly currentStep = signal<number>(1);
  wizardData: WizardData = {
    age: 68,
    householdSize: 2,
    monthlyIncome: 1450,
    disabilityHelp: true,
    needsFoodAssistance: true,
    hasChronicCondition: true
  };

  constructor() {
    // Load persisted state whenever active patient changes
    effect(() => {
      const patId = this.selectedPatientId();
      if (patId) {
        const key = STORAGE_KEY_PREFIX + patId;
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            this.wizardData = parsed.wizardData || this.getDefaultWizardData();
            this.currentStep.set(parsed.currentStep || 1);
          } catch {
            this.resetFormState();
          }
        } else {
          this.resetFormState();
        }
      } else {
        this.resetFormState();
      }
    }, { allowSignalWrites: true });
  }

  private getDefaultWizardData(): WizardData {
    return {
      age: 68,
      householdSize: 2,
      monthlyIncome: 1450,
      disabilityHelp: true,
      needsFoodAssistance: true,
      hasChronicCondition: true
    };
  }

  private resetFormState(): void {
    this.wizardData = this.getDefaultWizardData();
    this.currentStep.set(1);
  }

  private persistState(): void {
    const patId = this.selectedPatientId();
    if (!patId) return;
    const key = STORAGE_KEY_PREFIX + patId;
    localStorage.setItem(key, JSON.stringify({
      wizardData: this.wizardData,
      currentStep: this.currentStep()
    }));
  }

  nextStep(): void {
    if (this.currentStep() < 4) {
      this.currentStep.update((s) => s + 1);
      this.persistState();
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => s - 1);
      this.persistState();
    }
  }

  evaluateEligibility(): void {
    this.currentStep.set(4);
    this.persistState();
    this.toastService.success('Eligibility calculations completed based on latest criteria.');
  }

  resetWizard(): void {
    this.resetFormState();
    this.persistState();
  }

  // Eligibility Rules
  getFplThreshold(): number {
    // Basic mock FPL threshold calculation: base $1200 + $450 per additional household member
    return 1200 + (this.wizardData.householdSize - 1) * 450;
  }

  getFplRatio(): number {
    const threshold = this.getFplThreshold();
    return threshold > 0 ? (this.wizardData.monthlyIncome / threshold) * 100 : 0;
  }

  eligibleForMedicaidWaiver(): boolean {
    // Home waiver requires low income (< 150% FPL) and needing ADL support
    return this.getFplRatio() < 150 && this.wizardData.disabilityHelp;
  }

  eligibleForSnap(): boolean {
    // Food stamps requires income < 130% FPL, and is higher probability if flagged needsFoodAssistance
    return this.getFplRatio() < 130 && this.wizardData.needsFoodAssistance;
  }

  eligibleForMsp(): boolean {
    // Medicare savings requires age >= 65 and income < 135% FPL
    return this.wizardData.age >= 65 && this.getFplRatio() < 135;
  }

  roleLabel(): string {
    return ROLE_LABELS[this.roleService.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Welfare';
  }
}
