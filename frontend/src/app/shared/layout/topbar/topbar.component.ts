import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { ThemeService } from '../../../core/services/theme.service';
import { SyncService } from '../../../core/services/sync.service';
import { RoleService } from '../../../core/services/role.service';
import { ROLE_LABELS } from '../../../core/models/role.model';
import { RoleSwitcherComponent } from '../role-switcher/role-switcher.component';
import { CvBadgeComponent } from '../../components/cv-badge/cv-badge.component';
import { CvNotificationDropdownComponent } from '../../components/cv-notification/cv-notification.component';

interface SyncVisual {
  dot: string;
  ring: string;
  label: string;
  pulse: boolean;
}

@Component({
  selector: 'cv-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RoleSwitcherComponent, CvBadgeComponent, CvNotificationDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-4 md:px-6 h-16"
    >
      <a
        routerLink="/dashboard"
        class="md:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-glow"
        aria-label="Home"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </a>

      <div class="hidden sm:flex flex-col leading-tight min-w-0">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {{ currentRoleLabel() }}
        </span>
        <h1 class="text-base font-semibold text-slate-900 dark:text-slate-50 truncate">
          {{ pageTitle() }}
        </h1>
      </div>

      <div class="flex-1 max-w-md mx-auto">
        <label class="relative block">
          <span class="sr-only">Search</span>
          <span
            class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
            aria-hidden="true"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search patients, tasks, conversations…"
            class="w-full rounded-xl border border-slate-200/70 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 pl-9 pr-3 h-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-transparent transition-shadow"
          />
        </label>
      </div>

      <div class="flex items-center gap-2">
        <div
          class="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300"
          [attr.aria-label]="'Sync status: ' + syncVisual().label"
        >
          <span class="relative flex h-2 w-2">
            <span
              *ngIf="syncVisual().pulse"
              class="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              [ngClass]="syncVisual().ring"
              aria-hidden="true"
            ></span>
            <span class="relative inline-flex h-2 w-2 rounded-full" [ngClass]="syncVisual().dot" aria-hidden="true"></span>
          </span>
          <span class="hidden md:inline">{{ syncVisual().label }}</span>
        </div>

        <button
          type="button"
          (click)="theme.toggle()"
          class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/70 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <svg *ngIf="theme.isDark()" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path>
          </svg>
          <svg *ngIf="!theme.isDark()" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"></path>
          </svg>
        </button>

        <cv-notification-dropdown></cv-notification-dropdown>

        <cv-role-switcher></cv-role-switcher>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  protected readonly theme = inject(ThemeService);
  private readonly sync = inject(SyncService);
  private readonly roleService = inject(RoleService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);

  readonly currentRoleLabel = computed<string>(() => ROLE_LABELS[this.roleService.activeRole()]);

  private readonly currentRoute = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.deepestSnapshot(this.activatedRoute)),
      startWith(this.deepestSnapshot(this.activatedRoute)),
    ),
    { initialValue: this.deepestSnapshot(this.activatedRoute) },
  );

  readonly pageTitle = computed<string>(() => {
    const data = this.currentRoute().snapshot.data as Record<string, unknown> | undefined;
    if (data && typeof data['title'] === 'string') {
      return data['title'] as string;
    }
    return 'Dashboard';
  });

  readonly unread = signal(true);

  readonly syncVisual = computed<SyncVisual>(() => {
    const state = this.sync.state();
    switch (state) {
      case 'syncing':
        return {
          dot: 'bg-amber-500',
          ring: 'bg-amber-400',
          label: this.sync.label(),
          pulse: true,
        };
      case 'offline':
        return {
          dot: 'bg-slate-400',
          ring: 'bg-slate-300',
          label: this.sync.label(),
          pulse: false,
        };
      default:
        return {
          dot: 'bg-emerald-500',
          ring: 'bg-emerald-400',
          label: this.sync.label(),
          pulse: false,
        };
    }
  });

  private deepestSnapshot(route: ActivatedRoute): ActivatedRoute {
    let r = route;
    while (r.firstChild) {
      r = r.firstChild;
    }
    return r;
  }
}
