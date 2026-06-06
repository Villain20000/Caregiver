import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { RoleService } from '../../../core/services/role.service';
import { ALL_ROLES, ROLE_COLORS, ROLE_LABELS, Role } from '../../../core/models/role.model';
import { CvBadgeComponent } from '../../components/cv-badge/cv-badge.component';

interface NavItem {
  label: string;
  path: string;
  icon: string; // SVG path d-attr
  badge?: { label: string; tone: 'danger' | 'info' | 'primary' | 'success' | 'warning' };
}

const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  [Role.PATIENT]: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { label: 'SOS', path: '/sos', icon: 'M12 9v4m0 4h.01M5.07 19h13.86a2 2 0 0 0 1.74-3L13.74 4a2 2 0 0 0-3.48 0L3.33 16a2 2 0 0 0 1.74 3Z', badge: { label: 'Live', tone: 'danger' } },
    { label: 'Mood', path: '/mood', icon: 'M12 21s-7-4.35-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.65-7 10-7 10h-4Z' },
    { label: 'Burnout Check', path: '/burnout', icon: 'M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4ZM4 22v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1' },
    { label: 'Chat', path: '/chat', icon: 'M21 12a8 8 0 0 1-11.6 7.16L4 21l1.84-5.16A8 8 0 1 1 21 12Z' },
    { label: 'Notice Board', path: '/notice-board', icon: 'M4 4h12l4 4v12H4zM4 4v16M9 9h6M9 13h6M9 17h4' },
  ],
  [Role.FAMILY]: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { label: 'Calendar', path: '/calendar', icon: 'M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z' },
    { label: 'Tasks', path: '/tasks', icon: 'M9 11l3 3 7-7M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', badge: { label: '3', tone: 'info' } },
    { label: 'Chat', path: '/chat', icon: 'M21 12a8 8 0 0 1-11.6 7.16L4 21l1.84-5.16A8 8 0 1 1 21 12Z' },
    { label: 'Expenses', path: '/expenses', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    { label: 'Notice Board', path: '/notice-board', icon: 'M4 4h12l4 4v12H4zM4 4v16M9 9h6M9 13h6M9 17h4' },
  ],
  [Role.NURSE]: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { label: 'Vitals', path: '/vitals', icon: 'M3 12h4l3-9 4 18 3-9h4' },
    { label: 'Medication', path: '/medication', icon: 'M10 2h4a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2V4a2 2 0 0 1 2-2Z', badge: { label: '5 due', tone: 'warning' } },
    { label: 'Shift Clock', path: '/shift-clock', icon: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
    { label: 'Handover', path: '/handover', icon: 'M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7M21 16v5h-5M14 14l7 7M3 8V3h5M3 3l7 7' },
    { label: 'Burnout Check', path: '/burnout', icon: 'M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4ZM4 22v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1' },
    { label: 'Sync Status', path: '/sync', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { label: 'Chat (clinical)', path: '/chat', icon: 'M21 12a8 8 0 0 1-11.6 7.16L4 21l1.84-5.16A8 8 0 1 1 21 12Z' },
  ],
  [Role.THERAPIST]: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { label: 'Therapy', path: '/therapy', icon: 'M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4ZM4 22v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1' },
    { label: 'Calendar', path: '/calendar', icon: 'M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z' },
    { label: 'Chat', path: '/chat', icon: 'M21 12a8 8 0 0 1-11.6 7.16L4 21l1.84-5.16A8 8 0 1 1 21 12Z' },
  ],
  [Role.DOCTOR]: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { label: 'Vitals', path: '/vitals', icon: 'M3 12h4l3-9 4 18 3-9h4' },
    { label: 'Prescription', path: '/prescription', icon: 'M9 12h6M9 16h6M9 8h6M5 4h14a2 2 0 0 1 2 2v14l-4-3-4 3-4-3-4 3V6a2 2 0 0 1 2-2Z' },
    { label: 'Chat', path: '/chat', icon: 'M21 12a8 8 0 0 1-11.6 7.16L4 21l1.84-5.16A8 8 0 1 1 21 12Z' },
  ],
  [Role.SOCIAL_WORKER]: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { label: 'Welfare', path: '/welfare', icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z' },
    { label: 'Audit', path: '/audit', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M9 13l2 2 4-4' },
    { label: 'Chat', path: '/chat', icon: 'M21 12a8 8 0 0 1-11.6 7.16L4 21l1.84-5.16A8 8 0 1 1 21 12Z' },
  ],
  [Role.DISPATCHER]: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { label: 'SOS', path: '/sos', icon: 'M12 9v4m0 4h.01M5.07 19h13.86a2 2 0 0 0 1.74-3L13.74 4a2 2 0 0 0-3.48 0L3.33 16a2 2 0 0 0 1.74 3Z', badge: { label: 'Live', tone: 'danger' } },
    { label: 'Audit', path: '/audit', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M9 13l2 2 4-4' },
    { label: 'Map', path: '/map', icon: 'M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-1.447-.894L15 4m0 13V4M9 7l6-3' },
    { label: 'Sync Status', path: '/sync', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  ],
  [Role.NUTRITIONIST]: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { label: 'Diet', path: '/diet', icon: 'M3 11h18M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3M7 17v4M12 17v4M17 17v4' },
    { label: 'Chat', path: '/chat', icon: 'M21 12a8 8 0 0 1-11.6 7.16L4 21l1.84-5.16A8 8 0 1 1 21 12Z' },
  ],
  [Role.ADMIN]: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { label: 'Matching', path: '/matching', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
    { label: 'Calendar', path: '/calendar', icon: 'M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z' },
    { label: 'Inventory', path: '/inventory', icon: 'M21 8l-9-5-9 5m18 0v8l-9 5-9-5V8m18 0L12 13M3 8l9 5' },
    { label: 'Audit', path: '/audit', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M9 13l2 2 4-4' },
    { label: 'Sync Status', path: '/sync', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  ],
  [Role.BILLING]: [
    { label: 'Dashboard', path: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
    { label: 'Timesheet', path: '/timesheet', icon: 'M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM8 3v4M16 3v4' },
    { label: 'Insurance', path: '/insurance', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z' },
    { label: 'Expenses', path: '/expenses', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
    { label: 'Audit', path: '/audit', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M9 13l2 2 4-4' },
  ],
};

const ROLE_FAMILY_DESCRIPTION: Record<Role, string> = {
  [Role.PATIENT]: 'Care at your fingertips',
  [Role.FAMILY]: 'Stay close to your loved one',
  [Role.NURSE]: 'Bedside care, simplified',
  [Role.THERAPIST]: 'Run therapy with insight',
  [Role.DOCTOR]: 'Prescribe with confidence',
  [Role.SOCIAL_WORKER]: 'Welfare, audits, follow-through',
  [Role.DISPATCHER]: 'Route the right team, fast',
  [Role.NUTRITIONIST]: 'Plan meals that heal',
  [Role.ADMIN]: 'Operate the care network',
  [Role.BILLING]: 'Timesheets, claims, audits',
};

// Touch the constants so unused-import warnings don't fire on the helpers
// that other parts of the project will read.
export const _SIDEBAR_ROLE_LABELS = ROLE_LABELS;
export const _SIDEBAR_ALL_ROLES = ALL_ROLES;
export const _SIDEBAR_ROLE_COLORS = ROLE_COLORS;

@Component({
  selector: 'cv-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, CvBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      class="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur"
    >
      <!-- Brand -->
      <div class="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-glow"
          aria-hidden="true"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
        </div>
        <div class="flex flex-col leading-tight">
          <span class="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">CareVibe</span>
          <span class="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Caregiver OS</span>
        </div>
      </div>

      <!-- Workspace header with role badge -->
      <div class="mx-3 mb-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Workspace
        </p>
        <div class="mt-1.5 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="h-2 w-2 rounded-full shrink-0"
              [ngClass]="dotClassFor(activeRole())"
              aria-hidden="true"
            ></span>
            <p
              class="text-sm font-semibold truncate"
              [ngClass]="textClassFor(activeRole())"
            >{{ labelFor(activeRole()) }}</p>
          </div>
          <cv-badge tone="primary" [dot]="true">Active</cv-badge>
        </div>
        <p class="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {{ description() }}
        </p>
      </div>

      <!-- Nav -->
      <nav class="flex-1 overflow-y-auto px-3 pb-4">
        <p class="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Navigate
        </p>
        <ul class="flex flex-col gap-0.5">
          <li *ngFor="let item of items()">
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-500/30 shadow-sm"
              [routerLinkActiveOptions]="{ exact: false }"
              class="group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-indigo-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700 dark:group-hover:text-indigo-300 transition-colors"
                aria-hidden="true"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path [attr.d]="item.icon"></path>
                </svg>
              </span>
              <span class="flex-1 truncate">{{ item.label }}</span>
              <cv-badge *ngIf="item.badge" [tone]="item.badge.tone" [dot]="true">
                {{ item.badge.label }}
              </cv-badge>
            </a>
          </li>
        </ul>

        <!-- Footer card -->
        <div class="mt-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-3">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Tip
          </p>
          <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Use the role switcher in the topbar to explore CareVibe as any persona. Your choice is remembered.
          </p>
        </div>
      </nav>

      <!-- Bottom identity -->
      <div class="px-4 py-3 border-t border-slate-200/60 dark:border-slate-800">
        <div class="flex items-center gap-2.5">
          <span
            class="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-semibold"
            [ngClass]="'bg-gradient-to-br ' + gradientFor(activeRole())"
            aria-hidden="true"
          >{{ initialsFor(activeRole()) }}</span>
          <div class="min-w-0 leading-tight">
            <p class="text-xs font-semibold text-slate-900 dark:text-slate-50 truncate">
              {{ labelFor(activeRole()) }} demo
            </p>
            <p class="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              v0.1 · {{ familyFor(activeRole()) }}
            </p>
          </div>
        </div>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  private readonly roleService = inject(RoleService);

  readonly activeRole = this.roleService.activeRole;
  readonly items = computed<NavItem[]>(() => NAV_BY_ROLE[this.roleService.activeRole()]);
  readonly description = computed<string>(
    () => ROLE_FAMILY_DESCRIPTION[this.roleService.activeRole()],
  );

  labelFor(r: Role): string {
    return ROLE_LABELS[r];
  }
  descriptionFor(r: Role): string {
    return ROLE_FAMILY_DESCRIPTION[r];
  }
  textClassFor(r: Role): string {
    return this.tailwindColorFamily(r, 'text');
  }
  dotClassFor(r: Role): string {
    return this.tailwindColorFamily(r, 'bg');
  }
  gradientFor(r: Role): string {
    return ROLE_COLORS[r];
  }
  initialsFor(r: Role): string {
    return ROLE_LABELS[r].split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }
  familyFor(r: Role): string {
    return ROLE_FAMILY_DESCRIPTION[r];
  }

  private tailwindColorFamily(r: Role, prefix: 'text' | 'bg'): string {
    const grad = ROLE_COLORS[r];
    if (grad.includes('sky')) return prefix === 'text' ? 'text-sky-600 dark:text-sky-400' : 'bg-sky-500';
    if (grad.includes('pink')) return prefix === 'text' ? 'text-pink-600 dark:text-pink-400' : 'bg-pink-500';
    if (grad.includes('emerald')) return prefix === 'text' ? 'text-emerald-600 dark:text-emerald-400' : 'bg-emerald-500';
    if (grad.includes('violet')) return prefix === 'text' ? 'text-violet-600 dark:text-violet-400' : 'bg-violet-500';
    if (grad.includes('indigo')) return prefix === 'text' ? 'text-indigo-600 dark:text-indigo-400' : 'bg-indigo-500';
    if (grad.includes('amber')) return prefix === 'text' ? 'text-amber-600 dark:text-amber-400' : 'bg-amber-500';
    if (grad.includes('yellow')) return prefix === 'text' ? 'text-yellow-600 dark:text-yellow-400' : 'bg-yellow-500';
    if (grad.includes('lime')) return prefix === 'text' ? 'text-lime-600 dark:text-lime-400' : 'bg-lime-500';
    if (grad.includes('fuchsia')) return prefix === 'text' ? 'text-fuchsia-600 dark:text-fuchsia-400' : 'bg-fuchsia-500';
    return prefix === 'text' ? 'text-slate-600 dark:text-slate-300' : 'bg-slate-500';
  }
}
