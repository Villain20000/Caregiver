import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuditAction, AuditEntry } from '../../core/models/audit.model';
import { MOCK_USERS, User } from '../../core/models/user.model';
import { AuditService } from '../../core/services/audit.service';
import { RoleService } from '../../core/services/role.service';
import { ROLE_LABELS } from '../../core/models/role.model';
import { CvCardComponent } from '../../shared/components/cv-card/cv-card.component';
import { CvBadgeComponent, CvBadgeTone } from '../../shared/components/cv-badge/cv-badge.component';
import { CvStatTileComponent } from '../../shared/components/cv-stat-tile/cv-stat-tile.component';
import { CvButtonComponent } from '../../shared/components/cv-button/cv-button.component';

type SortDir = 'asc' | 'desc';

const ACTION_LABELS: Record<AuditAction, string> = {
  login: 'Login',
  logout: 'Logout',
  'role-switch': 'Role Switch',
  view: 'View',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  sign: 'Sign',
  export: 'Export',
  sync: 'Sync',
};

const ACTION_TONES: Record<AuditAction, CvBadgeTone> = {
  login: 'success',
  logout: 'neutral',
  'role-switch': 'warning',
  view: 'info',
  create: 'primary',
  update: 'info',
  delete: 'danger',
  sign: 'primary',
  export: 'neutral',
  sync: 'info',
};

@Component({
  selector: 'cv-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, CvCardComponent, CvBadgeComponent, CvStatTileComponent, CvButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <header class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <cv-badge tone="primary" [dot]="true">audit</cv-badge>
          <cv-badge tone="neutral">{{ roleLabel() }}</cv-badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {{ title() }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
          Immutable audit trail of all system events for compliance monitoring.
        </p>
      </header>

      <!-- Compliance Summary Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <cv-stat-tile label="Entries Today" [value]="todayCount()" tone="primary" icon="📋"></cv-stat-tile>
        <cv-stat-tile label="This Week" [value]="weekCount()" tone="info" icon="📅"></cv-stat-tile>
        <cv-stat-tile label="This Month" [value]="monthCount()" tone="neutral" icon="📊"></cv-stat-tile>
        <cv-stat-tile label="Role Switches (24h)" [value]="roleSwitchCount()" [tone]="roleSwitchCount() > 5 ? 'danger' : 'success'" icon="🔄"></cv-stat-tile>
      </div>

      <!-- Warning Banner -->
      <div
        *ngIf="roleSwitchCount() > 5"
        class="flex items-center gap-3 rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-5 py-3 text-sm text-rose-700 dark:text-rose-300"
      >
        <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span>
          <strong>Suspicious activity detected:</strong> {{ roleSwitchCount() }} role switches in the last 24 hours. Review immediately for potential security concerns.
        </span>
      </div>

      <!-- Filters -->
      <cv-card title="Filters" subtitle="Narrow the audit trail" padding="md">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Action filter -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-400">Action</label>
            <select
              [ngModel]="filterAction()"
              (ngModelChange)="filterAction.set($event)"
              class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 h-10 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <option value="">All Actions</option>
              <option *ngFor="let a of allActions" [value]="a">{{ ACTION_LABELS[a] }}</option>
            </select>
          </div>

          <!-- User filter -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-400">User</label>
            <select
              [ngModel]="filterUser()"
              (ngModelChange)="filterUser.set($event)"
              class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 h-10 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <option value="">All Users</option>
              <option *ngFor="let u of users" [value]="u.id">{{ u.name }}</option>
            </select>
          </div>

          <!-- Date range -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-400">Start Date</label>
            <input
              type="date"
              [ngModel]="filterDateStart()"
              (ngModelChange)="filterDateStart.set($event)"
              class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 h-10 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-400">End Date</label>
            <input
              type="date"
              [ngModel]="filterDateEnd()"
              (ngModelChange)="filterDateEnd.set($event)"
              class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 h-10 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </div>

          <!-- Search -->
          <div class="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-4">
            <label class="text-xs font-medium text-slate-500 dark:text-slate-400">Search Resource</label>
            <input
              type="text"
              [ngModel]="filterSearch()"
              (ngModelChange)="filterSearch.set($event)"
              placeholder="Search by resource text (patient, medication, shift...)"
              class="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 h-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </div>
        </div>
      </cv-card>

      <!-- Audit Table -->
      <cv-card title="Audit Trail" [subtitle]="filteredEntries().length + ' entries'" padding="none">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100 dark:border-slate-800">
                <th
                  class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200"
                  (click)="toggleSort()"
                >
                  <div class="flex items-center gap-1">
                    Timestamp
                    <svg *ngIf="sortDir() === 'desc'" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    <svg *ngIf="sortDir() === 'asc'" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
                  </div>
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">User</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Action</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Resource</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">IP</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Details</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50">
              <tr *ngFor="let entry of filteredEntries()" class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td class="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  {{ formatTs(entry.ts) }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <span class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {{ initials(entry.userName) }}
                    </span>
                    <span class="text-slate-900 dark:text-slate-100 font-medium">{{ entry.userName }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <cv-badge [tone]="getActionTone(entry.action)">{{ ACTION_LABELS[entry.action] }}</cv-badge>
                </td>
                <td class="px-4 py-3 max-w-[200px] truncate font-mono text-xs text-slate-700 dark:text-slate-300">
                  {{ entry.resource }}
                </td>
                <td class="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {{ entry.ip || '—' }}
                </td>
                <td class="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[180px] truncate">
                  {{ entry.meta ? formatMeta(entry.meta) : '—' }}
                </td>
              </tr>
              <tr *ngIf="filteredEntries().length === 0">
                <td colspan="6" class="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  No audit entries match your filters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </cv-card>
    </div>
  `,
})
export class AuditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly role = inject(RoleService);
  private readonly auditService = inject(AuditService);

  readonly ACTION_LABELS = ACTION_LABELS;
  readonly ACTION_TONES = ACTION_TONES;

  readonly allActions: AuditAction[] = ['login', 'logout', 'role-switch', 'view', 'create', 'update', 'delete', 'sign', 'export', 'sync'];
  readonly users = MOCK_USERS;

  // Filter signals
  readonly filterAction = signal<AuditAction | ''>('');
  readonly filterUser = signal<string>('');
  readonly filterDateStart = signal<string>('');
  readonly filterDateEnd = signal<string>('');
  readonly filterSearch = signal<string>('');
  readonly sortDir = signal<SortDir>('desc');

  readonly entries = this.auditService.entries;

  readonly filteredEntries = computed<AuditEntry[]>(() => {
    const all = this.entries();
    const action = this.filterAction();
    const userId = this.filterUser();
    const start = this.filterDateStart();
    const end = this.filterDateEnd();
    const search = this.filterSearch().toLowerCase();
    const dir = this.sortDir();

    let filtered = all;

    if (action) {
      filtered = filtered.filter((e) => e.action === action);
    }
    if (userId) {
      filtered = filtered.filter((e) => e.userId === userId);
    }
    if (start) {
      const startMs = new Date(start).getTime();
      filtered = filtered.filter((e) => new Date(e.ts).getTime() >= startMs);
    }
    if (end) {
      const endMs = new Date(end).getTime() + 86_400_000;
      filtered = filtered.filter((e) => new Date(e.ts).getTime() <= endMs);
    }
    if (search) {
      filtered = filtered.filter((e) => e.resource.toLowerCase().includes(search));
    }

    return [...filtered].sort((a, b) => {
      const cmp = new Date(a.ts).getTime() - new Date(b.ts).getTime();
      return dir === 'desc' ? -cmp : cmp;
    });
  });

  readonly todayCount = computed<number>(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return this.entries().filter((e) => new Date(e.ts).getTime() >= startOfDay).length;
  });

  readonly weekCount = computed<number>(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return this.entries().filter((e) => new Date(e.ts).getTime() >= startOfWeek.getTime()).length;
  });

  readonly monthCount = computed<number>(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return this.entries().filter((e) => new Date(e.ts).getTime() >= startOfMonth).length;
  });

  readonly roleSwitchCount = computed<number>(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return this.entries().filter((e) => e.action === 'role-switch' && new Date(e.ts).getTime() >= cutoff).length;
  });

  roleLabel(): string {
    return ROLE_LABELS[this.role.activeRole()];
  }

  title(): string {
    const t = this.route.snapshot.data['title'];
    return typeof t === 'string' ? t : 'Audit Log';
  }

  toggleSort(): void {
    this.sortDir.update((d) => (d === 'desc' ? 'asc' : 'desc'));
  }

  getActionTone(action: AuditAction): CvBadgeTone {
    return ACTION_TONES[action] ?? 'neutral';
  }

  formatTs(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  formatMeta(meta: Record<string, string | number | boolean | null>): string {
    return Object.entries(meta)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
}
