import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent, CvBadgeTone } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvModalComponent } from '../../shared/components/cv-modal/cv-modal.component';
import { CvStatTileComponent } from '../../shared/components/cv-stat-tile/cv-stat-tile.component';
import { RoleService } from '../../core/services/role.service';
import { Role } from '../../core/models/role.model';
import { ROLE_LABELS } from '../../core/models/role.model';
import { BillingService } from '../../core/services/billing.service';
import { Claim } from '../../core/models/billing.model';
import { AuthService } from '../../core/services/auth.service';

type ClaimStep = 'queued' | 'submitted' | 'accepted' | 'denied' | 'paid' | 'appealed';

interface StepConfig {
  key: ClaimStep;
  label: string;
  tone: CvBadgeTone;
  icon: string;
}

const CLAIM_STEPS: StepConfig[] = [
  { key: 'queued', label: 'Queued', tone: 'neutral', icon: 'M12 6v6l4 2' },
  { key: 'submitted', label: 'Submitted', tone: 'info', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'accepted', label: 'Accepted', tone: 'success', icon: 'M5 13l4 4L19 7' },
  { key: 'denied', label: 'Denied', tone: 'danger', icon: 'M6 18L18 6M6 6l12 12' },
  { key: 'paid', label: 'Paid', tone: 'success', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'appealed', label: 'Appealed', tone: 'warning', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' },
];

const STATUS_TONE: Record<string, CvBadgeTone> = {
  queued: 'neutral',
  submitted: 'info',
  accepted: 'success',
  paid: 'success',
  denied: 'danger',
  appealed: 'warning',
};

const ORDERED_STEPS: ClaimStep[] = ['queued', 'submitted', 'accepted', 'paid', 'denied', 'appealed'];

function claimStepIndex(status: ClaimStep): number {
  const idx = ORDERED_STEPS.indexOf(status);
  if (status === 'appealed') return 2;
  if (status === 'denied') return 3;
  return idx >= 0 ? idx : 0;
}

function getDaysRemaining(deadline?: string): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function getPayerTone(payer: string): CvBadgeTone {
  const p = payer.toLowerCase();
  if (p.includes('medicare')) return 'primary';
  if (p.includes('bcbs')) return 'info';
  if (p.includes('aetna')) return 'warning';
  if (p.includes('self')) return 'neutral';
  return 'neutral';
}

@Component({
  selector: 'cv-insurance',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe, CurrencyPipe,
    CvCardComponent, CvBadgeComponent, CvButtonComponent,
    CvModalComponent, CvStatTileComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">insurance</cv-badge>
          <cv-badge [tone]="'neutral'">{{ roleLabel() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {{ title() }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Insurance claim lifecycle tracker — monitor and manage claims from submission to payment.
        </p>
      </header>

      <!-- Stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <cv-stat-tile
          label="Total Claims"
          [value]="stats().total"
          tone="primary"
          icon="📋"
        ></cv-stat-tile>
        <cv-stat-tile
          label="Pending"
          [value]="stats().pending"
          tone="warning"
          icon="⏳"
        ></cv-stat-tile>
        <cv-stat-tile
          label="Paid"
          [value]="stats().paid"
          tone="success"
          icon="✅"
        ></cv-stat-tile>
        <cv-stat-tile
          label="Denied"
          [value]="stats().denied"
          tone="danger"
          icon="❌"
        ></cv-stat-tile>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-slate-500 dark:text-slate-400">Status</label>
          <select
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event)"
            class="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="submitted">Submitted</option>
            <option value="accepted">Accepted</option>
            <option value="paid">Paid</option>
            <option value="denied">Denied</option>
            <option value="appealed">Appealed</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-slate-500 dark:text-slate-400">Payer</label>
          <select
            [ngModel]="payerFilter()"
            (ngModelChange)="payerFilter.set($event)"
            class="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Payers</option>
            @for (p of distinctPayers(); track p) {
              <option [value]="p">{{ p }}</option>
            }
          </select>
        </div>
        <button
          class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          (click)="statusFilter.set(''); payerFilter.set('')"
        >
          Clear filters
        </button>
      </div>

      <!-- Claim Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        @for (claim of filteredClaims(); track claim.id) {
          <cv-card
            [title]="'Claim ' + claim.id"
            [subtitle]="claim.cpt + ' · ' + (claim.amount | currency:'USD':'symbol':'1.0-0')"
            padding="md"
          >
            <div class="space-y-4">
              <!-- Progress Wizard -->
              <div class="flex items-center justify-between">
                @for (step of claimSteps(); track step.key) {
                  @let stepIdx = $index;
                  @let isActive = isStepActive(claim, step.key);
                  @let isComplete = isStepComplete(claim, step.key);
                  @let isCurrent = claim.status === step.key;

                  <div class="flex flex-col items-center gap-1 relative">
                    <div
                      class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-200 cursor-pointer"
                      [ngClass]="{
                        'bg-indigo-600 text-white shadow-md scale-110 ring-2 ring-indigo-300 dark:ring-indigo-600': isCurrent,
                        'bg-emerald-500 text-white': isComplete && !isCurrent,
                        'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500': !isCurrent && !isComplete && !isActive,
                        'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400': isActive && !isCurrent && !isComplete
                      }"
                      (click)="selectClaim(claim)"
                    >
                      @if (isComplete) {
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      } @else {
                        {{ stepIdx + 1 }}
                      }
                    </div>
                    <span
                      class="text-[10px] font-medium whitespace-nowrap"
                      [ngClass]="{
                        'text-indigo-600 dark:text-indigo-400': isCurrent,
                        'text-slate-500 dark:text-slate-400': !isCurrent
                      }"
                    >
                      {{ step.label }}
                    </span>
                    @if (!$last) {
                      <div
                        class="absolute top-4 -right-1/2 h-0.5 w-full -z-10"
                        [ngClass]="{
                          'bg-emerald-400': isComplete && claimStepIndex(claim.status) > stepIdx,
                          'bg-slate-200 dark:bg-slate-700': !(isComplete && claimStepIndex(claim.status) > stepIdx)
                        }"
                      ></div>
                    }
                  </div>
                }
              </div>

              <!-- Quick Info -->
              <div class="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span class="text-slate-500 dark:text-slate-400">Payer</span>
                  <cv-badge [tone]="getPayerTone(claim.payer)">{{ claim.payer }}</cv-badge>
                </div>
                <div>
                  <span class="text-slate-500 dark:text-slate-400">Amount</span>
                  <p class="font-semibold text-slate-900 dark:text-slate-50">{{ claim.amount | currency:'USD':'symbol':'1.0-0' }}</p>
                </div>
                <div>
                  <span class="text-slate-500 dark:text-slate-400">Status</span>
                  <cv-badge [tone]="statusTone(claim.status)">{{ claim.status }}</cv-badge>
                </div>
                <div>
                  <span class="text-slate-500 dark:text-slate-400">Submitted</span>
                  <p class="text-slate-900 dark:text-slate-50">{{ claim.submittedAt ? (claim.submittedAt | date:'MMM d, y') : '\u2014' }}</p>
                </div>
              </div>

              @if (claim.status === 'denied' && claim.denialReason) {
                <div class="rounded-lg bg-rose-50 dark:bg-rose-500/10 p-3 text-xs">
                  <p class="font-medium text-rose-700 dark:text-rose-300">Denied: {{ claim.denialReason }}</p>
                </div>
              }
              @if (claim.appealDeadline) {
                @let days = getDaysRemaining(claim.appealDeadline);
                <div
                  class="rounded-lg p-3 text-xs"
                  [ngClass]="{
                    'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300': days !== null && days > 0,
                    'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300': days !== null && days <= 0
                  }"
                >
                  <p class="font-medium">
                    Appeal deadline: {{ claim.appealDeadline | date:'MMM d, y' }}
                    @if (days !== null) {
                      ({{ days > 0 ? days + ' days remaining' : 'Overdue' }})
                    }
                  </p>
                </div>
              }

              <div class="flex justify-end">
                <cv-button variant="ghost" size="sm" (click)="selectClaim(claim)">
                  View Details
                </cv-button>
              </div>
            </div>
          </cv-card>
        } @empty {
          <div class="col-span-2 text-center py-12 text-slate-500 dark:text-slate-400">
            No claims match the current filters.
          </div>
        }
      </div>
    </div>

    <!-- Detail Modal -->
    <cv-modal
      [open]="selectedClaim() !== null"
      [title]="selectedClaim() ? 'Claim ' + selectedClaim()!.id : ''"
      size="lg"
      [hasFooter]="true"
      (closed)="selectedClaim.set(null)"
    >
      @if (selectedClaim(); as claim) {
        <div class="space-y-6">
          <!-- Status Pipeline -->
          <div class="flex items-center justify-between px-2">
            @for (step of claimSteps(); track step.key) {
              @let isCurrent = claim.status === step.key;
              @let isCompl = isStepComplete(claim, step.key);
              <div class="flex flex-col items-center gap-1.5">
                <div
                  class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all"
                  [ngClass]="{
                    'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 dark:ring-indigo-600 scale-110': isCurrent,
                    'bg-emerald-500 text-white': isCompl && !isCurrent,
                    'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500': !isCurrent && !isCompl
                  }"
                >
                  @if (isCompl) {
                    <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  } @else {
                    {{ step.label.charAt(0) }}
                  }
                </div>
                <span
                  class="text-xs font-medium"
                  [ngClass]="{
                    'text-indigo-600 dark:text-indigo-400': isCurrent,
                    'text-emerald-600 dark:text-emerald-400': isCompl && !isCurrent,
                    'text-slate-400 dark:text-slate-500': !isCurrent && !isCompl
                  }"
                >
                  {{ step.label }}
                </span>
              </div>
              @if (!$last) {
                <div
                  class="flex-1 h-0.5 mx-2"
                  [ngClass]="{
                    'bg-emerald-400': isCompl && claimStepIndex(claim.status) > $index,
                    'bg-slate-200 dark:bg-slate-700': !(isCompl && claimStepIndex(claim.status) > $index)
                  }"
                ></div>
              }
            }
          </div>

          <!-- Claim Details Grid -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-3">
              <div>
                <p class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Claim ID</p>
                <p class="text-sm font-semibold text-slate-900 dark:text-slate-50">{{ claim.id }}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Invoice</p>
                <p class="text-sm text-slate-900 dark:text-slate-50">{{ claim.invoiceId }}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">CPT Code</p>
                <p class="text-sm font-mono text-slate-900 dark:text-slate-50">{{ claim.cpt }}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Payer</p>
                <cv-badge [tone]="getPayerTone(claim.payer)">{{ claim.payer }}</cv-badge>
              </div>
            </div>
            <div class="space-y-3">
              <div>
                <p class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</p>
                <cv-badge [tone]="statusTone(claim.status)">{{ claim.status }}</cv-badge>
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Amount</p>
                <p class="text-lg font-bold text-slate-900 dark:text-slate-50">{{ claim.amount | currency:'USD':'symbol':'1.2-2' }}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Submitted</p>
                <p class="text-sm text-slate-900 dark:text-slate-50">{{ claim.submittedAt ? (claim.submittedAt | date:'MMM d, y, h:mm a') : 'Not yet submitted' }}</p>
              </div>
            </div>
          </div>

          @if (claim.status === 'denied' && claim.denialReason) {
            <div class="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-500/10 p-4">
              <div class="flex items-start gap-3">
                <svg class="h-5 w-5 mt-0.5 text-rose-600 dark:text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <div>
                  <p class="text-sm font-semibold text-rose-700 dark:text-rose-300">Claim Denied</p>
                  <p class="text-sm text-rose-600 dark:text-rose-400 mt-1">{{ claim.denialReason }}</p>
                  @if (claim.appealDeadline) {
                    @let days = getDaysRemaining(claim.appealDeadline);
                    <p
                      class="text-sm mt-2 font-medium"
                      [ngClass]="{
                        'text-amber-600 dark:text-amber-400': days !== null && days > 0,
                        'text-rose-600 dark:text-rose-400': days !== null && days <= 0
                      }"
                    >
                      Appeal deadline: {{ claim.appealDeadline | date:'MMM d, y' }}
                      @if (days !== null) {
                        ({{ days > 0 ? days + ' days remaining' : 'Overdue' }})
                      }
                    </p>
                  }
                </div>
              </div>
            </div>
          }

          @if (claim.status === 'appealed') {
            <div class="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-500/10 p-4">
              <div class="flex items-start gap-3">
                <svg class="h-5 w-5 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <div>
                  <p class="text-sm font-semibold text-amber-700 dark:text-amber-300">Claim Under Appeal</p>
                  <p class="text-sm text-amber-600 dark:text-amber-400 mt-1">
                    This claim has been appealed and is under review.
                  </p>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <ng-container cv-modal-footer>
        <cv-button variant="ghost" size="sm" (click)="selectedClaim.set(null)">Close</cv-button>
      </ng-container>
    </cv-modal>
  `,
})
export class InsuranceComponent {
  private readonly role = inject(RoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly billing = inject(BillingService);
  private readonly auth = inject(AuthService);

  readonly selectedClaim = signal<Claim | null>(null);
  readonly statusFilter = signal<string>('');
  readonly payerFilter = signal<string>('');

  readonly claimSteps = signal<StepConfig[]>(CLAIM_STEPS);

  readonly allClaims = this.billing.claims;

  readonly distinctPayers = computed<string[]>(() => {
    const payers = new Set(this.allClaims().map((c) => c.payer));
    return Array.from(payers).sort();
  });

  readonly stats = computed(() => {
    const claims = this.allClaims();
    return {
      total: claims.length,
      pending: claims.filter((c) => c.status === 'queued' || c.status === 'submitted').length,
      paid: claims.filter((c) => c.status === 'paid').length,
      denied: claims.filter((c) => c.status === 'denied' || c.status === 'appealed').length,
    };
  });

  readonly filteredClaims = computed(() => {
    let claims = this.allClaims();
    const sf = this.statusFilter();
    const pf = this.payerFilter();
    if (sf) claims = claims.filter((c) => c.status === sf);
    if (pf) claims = claims.filter((c) => c.payer === pf);
    return claims;
  });

  roleLabel(): string {
    return ROLE_LABELS[this.role.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Insurance';
  }

  getPayerTone(payer: string): CvBadgeTone {
    return getPayerTone(payer);
  }

  statusTone(status: string): CvBadgeTone {
    return STATUS_TONE[status] ?? 'neutral';
  }

  getDaysRemaining(deadline?: string): number | null {
    return getDaysRemaining(deadline);
  }

  isStepActive(claim: Claim, stepKey: string): boolean {
    return claimStepIndex(claim.status as ClaimStep) >= ORDERED_STEPS.indexOf(stepKey as ClaimStep);
  }

  isStepComplete(claim: Claim, stepKey: string): boolean {
    const claimIdx = claimStepIndex(claim.status as ClaimStep);
    const stepIdx = ORDERED_STEPS.indexOf(stepKey as ClaimStep);
    if (claim.status === 'denied') {
      if (stepKey === 'accepted') return true;
      return stepIdx < claimIdx;
    }
    if (claim.status === 'appealed') {
      if (stepKey === 'accepted') return true;
      if (stepKey === 'submitted' || stepKey === 'queued') return true;
      return false;
    }
    return claimIdx > stepIdx;
  }

  selectClaim(claim: Claim): void {
    this.selectedClaim.set(claim);
  }

  claimStepIndex(status: ClaimStep): number {
    return claimStepIndex(status);
  }
}
