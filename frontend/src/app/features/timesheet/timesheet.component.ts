import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent, CvBadgeTone } from '../../shared/components/cv-badge/cv-badge.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';
import { CvModalComponent } from '../../shared/components/cv-modal/cv-modal.component';
import { CvStatTileComponent } from '../../shared/components/cv-stat-tile/cv-stat-tile.component';
import { CvAvatarComponent } from '../../shared/components/cv-avatar/cv-avatar.component';
import { RoleService } from '../../core/services/role.service';
import { Role } from '../../core/models/role.model';
import { ROLE_LABELS } from '../../core/models/role.model';
import { BillingService } from '../../core/services/billing.service';
import { Timesheet } from '../../core/models/billing.model';
import { AuthService } from '../../core/services/auth.service';

const STATUS_TONE: Record<string, CvBadgeTone> = {
  open: 'neutral',
  submitted: 'info',
  approved: 'success',
  rejected: 'danger',
  exported: 'primary',
};

const HOURLY_RATES: Record<string, number> = {
  [Role.NURSE]: 42,
  [Role.THERAPIST]: 55,
  [Role.SOCIAL_WORKER]: 38,
  [Role.NUTRITIONIST]: 35,
  [Role.DISPATCHER]: 28,
  [Role.ADMIN]: 45,
  [Role.BILLING]: 40,
};

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  return Math.ceil((diff / 86_400_000 + startOfYear.getDay() + 1) / 7);
}

@Component({
  selector: 'cv-timesheet',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe, CurrencyPipe,
    CvCardComponent, CvBadgeComponent, CvButtonComponent,
    CvModalComponent, CvStatTileComponent, CvAvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">timesheet</cv-badge>
          <cv-badge [tone]="'neutral'">{{ roleLabel() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {{ title() }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Automated timesheet generator — track hours, calculate pay, and export for billing.
        </p>
      </header>

      <!-- Summary Card -->
      <cv-card padding="md">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <cv-stat-tile
            label="Week {{ weekNumber() }}"
            [value]="totalHours() + 'h'"
            tone="primary"
            icon="📅"
          ></cv-stat-tile>
          <cv-stat-tile
            label="Total Pay"
            [value]="formatPay()"
            tone="success"
            icon="💰"
          ></cv-stat-tile>
          <cv-stat-tile
            label="Entries"
            [value]="entries().length"
            tone="neutral"
            icon="📋"
          ></cv-stat-tile>
          <cv-stat-tile
            label="Pending Approval"
            [value]="pendingCount()"
            tone="warning"
            icon="⏳"
          ></cv-stat-tile>
        </div>
        <div class="mt-4 flex items-center justify-between">
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ entries().length }} timesheet entries · {{ totalHours() }} total hours
          </p>
          <div class="flex gap-2">
            @if (canExport()) {
              <cv-button variant="primary" size="sm" (click)="exportCsv()">
                {{ exportLabel() }}
              </cv-button>
            }
            @if (canApprove()) {
              <cv-button variant="success" size="sm" (click)="showApproveModal.set(true)">
                Approve Selected
              </cv-button>
            }
          </div>
        </div>
      </cv-card>

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
            <option value="open">Open</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="exported">Exported</option>
          </select>
        </div>
        <button
          class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          (click)="statusFilter.set('')"
        >
          Clear filters
        </button>
      </div>

      <!-- Timesheet Table -->
      <div class="overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Staff</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Shift</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Clock In</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Clock Out</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Hours</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (entry of filteredEntries(); track entry.id) {
                @let user = getUser(entry.userId);
                <tr class="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2.5">
                      <cv-avatar
                        [name]="user?.name ?? entry.userId"
                        [size]="'sm'"
                        [role]="user?.role"
                        [status]="user?.online ? 'online' : 'offline'"
                      ></cv-avatar>
                      <span class="font-medium text-slate-900 dark:text-slate-50 text-sm">
                        {{ user?.name ?? entry.userId }}
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {{ entry.shiftId }}
                  </td>
                  <td class="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {{ entry.clockIn | date:'MMM d, h:mm a' }}
                  </td>
                  <td class="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    @if (entry.clockOut) {
                      {{ entry.clockOut | date:'h:mm a' }}
                    } @else {
                      <span class="text-amber-500 dark:text-amber-400 italic">In progress</span>
                    }
                  </td>
                  <td class="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-50">
                    {{ entry.hours.toFixed(1) }}
                  </td>
                  <td class="px-4 py-3 text-center">
                    <cv-badge [tone]="statusTone(entry.status)">{{ entry.status }}</cv-badge>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex items-center justify-end gap-2">
                      @if (entry.status === 'open' || entry.status === 'submitted') {
                        @if (canApprove()) {
                          <cv-button variant="success" size="sm" (click)="approveEntry(entry.id)">
                            Approve
                          </cv-button>
                        }
                        @if ((hasRoleNurse() || hasRoleTherapist()) && entry.userId === currentUserId()) {
                          <cv-button variant="primary" size="sm" (click)="submitEntry(entry.id)">
                            Submit
                          </cv-button>
                        }
                      }
                      @if (entry.notes) {
                        <cv-button variant="ghost" size="sm" (click)="showNotes(entry)">
                          Notes
                        </cv-button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    No timesheet entries found.
                  </td>
                </tr>
              }
            </tbody>
            <tfoot class="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/80">
              <tr>
                <td colspan="4" class="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-50 text-right">
                  Total
                </td>
                <td class="px-4 py-3 text-right font-mono font-bold text-lg text-indigo-600 dark:text-indigo-400">
                  {{ totalHours() }}
                </td>
                <td colspan="2" class="px-4 py-3 text-right">
                  <span class="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {{ formatPay() }}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Notes Modal -->
    <cv-modal
      [open]="showNotesModal()"
      [title]="'Timesheet Notes'"
      size="md"
      [hasFooter]="true"
      (closed)="showNotesModal.set(false)"
    >
      @if (selectedEntry(); as entry) {
        <p class="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
          {{ entry.notes }}
        </p>
      }
      <ng-container cv-modal-footer>
        <cv-button variant="ghost" size="sm" (click)="showNotesModal.set(false)">Close</cv-button>
      </ng-container>
    </cv-modal>

    <!-- Approve Confirmation Modal -->
    <cv-modal
      [open]="showApproveModal()"
      title="Approve Pending Timesheets"
      size="sm"
      [hasFooter]="true"
      (closed)="showApproveModal.set(false)"
    >
      <p class="text-sm text-slate-600 dark:text-slate-300">
        Approve all {{ pendingCount() }} pending timesheet entries? This action can be reversed.
      </p>
      <ng-container cv-modal-footer>
        <cv-button variant="ghost" size="sm" (click)="showApproveModal.set(false)">Cancel</cv-button>
        <cv-button variant="success" size="sm" (click)="approveAll(); showApproveModal.set(false)">
          Approve All
        </cv-button>
      </ng-container>
    </cv-modal>

    <!-- Export Toast Notification -->
    @if (showExportToast()) {
      <div class="fixed bottom-6 right-6 z-50 animate-slide-up">
        <div class="rounded-xl bg-emerald-600 text-white px-5 py-3 shadow-lg flex items-center gap-3 text-sm">
          <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>Timesheet exported successfully!</span>
        </div>
      </div>
    }
  `,
  styles: [
    `
      @keyframes slide-up {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-slide-up {
        animation: slide-up 300ms ease-out;
      }
    `,
  ],
})
export class TimesheetComponent {
  private readonly role = inject(RoleService);
  private readonly route = inject(ActivatedRoute);
  private readonly billing = inject(BillingService);
  private readonly auth = inject(AuthService);

  readonly statusFilter = signal<string>('');
  readonly showNotesModal = signal(false);
  readonly showApproveModal = signal(false);
  readonly selectedEntry = signal<Timesheet | null>(null);
  readonly showExportToast = signal(false);

  readonly currentUser = this.auth.currentUser;
  readonly currentUserId = computed(() => this.currentUser().id);
  readonly activeRole = this.role.activeRole;

  readonly allEntries = this.billing.timesheets;

  readonly weekNumber = computed(() => getWeekNumber(new Date()));

  readonly entries = computed(() => {
    const entries = this.allEntries();
    const role = this.activeRole();
    const uid = this.currentUserId();
    if (role === Role.NURSE || role === Role.THERAPIST || role === Role.SOCIAL_WORKER || role === Role.NUTRITIONIST || role === Role.DISPATCHER) {
      return entries.filter((e) => e.userId === uid);
    }
    return entries;
  });

  readonly filteredEntries = computed(() => {
    let entries = this.entries();
    const sf = this.statusFilter();
    if (sf) entries = entries.filter((e) => e.status === sf);
    return entries;
  });

  readonly totalHours = computed(() =>
    this.filteredEntries().reduce((sum, e) => sum + e.hours, 0)
  );

  readonly totalPay = computed(() => {
    const entries = this.filteredEntries();
    return entries.reduce((sum, e) => {
      const user = this.getUser(e.userId);
      const rate = user?.role ? (HOURLY_RATES[user.role] ?? 35) : 35;
      return sum + e.hours * rate;
    }, 0);
  });

  readonly pendingCount = computed(() =>
    this.allEntries().filter((e) => e.status === 'open' || e.status === 'submitted').length
  );

  readonly canExport = computed(() => {
    const role = this.activeRole();
    return role === Role.BILLING || role === Role.ADMIN;
  });

  readonly exportLabel = computed(() => {
    const role = this.activeRole();
    if (role === Role.BILLING) return 'Export to Billing System';
    return 'Download CSV';
  });

  readonly canApprove = computed(() => {
    const role = this.activeRole();
    return role === Role.ADMIN;
  });

  readonly hasRoleNurse = computed(() => this.activeRole() === Role.NURSE);
  readonly hasRoleTherapist = computed(() => this.activeRole() === Role.THERAPIST);

  roleLabel(): string {
    return ROLE_LABELS[this.role.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Timesheets';
  }

  formatPay(): string {
    return '$' + this.totalPay().toFixed(2);
  }

  statusTone(status: string): CvBadgeTone {
    return STATUS_TONE[status] ?? 'neutral';
  }

  getUser(userId: string) {
    return this.auth.getUserById(userId);
  }

  submitEntry(id: string): void {
    this.billing.submitTimesheet(id);
  }

  approveEntry(id: string): void {
    this.billing.approveTimesheet(id, this.currentUserId());
  }

  approveAll(): void {
    const pending = this.allEntries().filter((e) => e.status === 'open' || e.status === 'submitted');
    for (const entry of pending) {
      this.billing.approveTimesheet(entry.id, this.currentUserId());
    }
  }

  showNotes(entry: Timesheet): void {
    this.selectedEntry.set(entry);
    this.showNotesModal.set(true);
  }

  exportCsv(): void {
    const entries = this.filteredEntries();
    const header = 'ID,User,Shift,Clock In,Clock Out,Hours,Status,Notes';
    const rows = entries.map((e) => {
      const user = this.getUser(e.userId);
      return `${e.id},${user?.name ?? e.userId},${e.shiftId},${e.clockIn},${e.clockOut ?? ''},${e.hours},${e.status},${e.notes ?? ''}`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet-week-${this.weekNumber()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.showExportToast.set(true);
    setTimeout(() => this.showExportToast.set(false), 3000);
  }
}