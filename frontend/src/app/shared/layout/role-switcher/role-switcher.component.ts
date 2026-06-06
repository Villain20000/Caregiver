import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RoleService } from '../../../core/services/role.service';
import { CvAvatarComponent } from '../../components/cv-avatar/cv-avatar.component';
import { ALL_ROLES, ROLE_COLORS, ROLE_LABELS, Role } from '../../../core/models/role.model';

interface RoleRow {
  id: Role;
  label: string;
  blurb: string;
  gradient: string;
}

const ROLE_BLURBS: Record<Role, string> = {
  [Role.PATIENT]: 'I am receiving care',
  [Role.FAMILY]: 'I coordinate care for a loved one',
  [Role.NURSE]: 'I deliver bedside care',
  [Role.THERAPIST]: 'I run therapy sessions',
  [Role.DOCTOR]: 'I prescribe and oversee care',
  [Role.SOCIAL_WORKER]: 'I coordinate welfare services',
  [Role.DISPATCHER]: 'I triage SOS and route teams',
  [Role.NUTRITIONIST]: 'I plan meals and diet',
  [Role.ADMIN]: 'I run matching, calendar, inventory',
  [Role.BILLING]: 'I handle timesheets, insurance, expenses',
};

const ROW_LIST: RoleRow[] = ALL_ROLES.map((r) => ({
  id: r,
  label: ROLE_LABELS[r],
  blurb: ROLE_BLURBS[r],
  gradient: ROLE_COLORS[r],
}));

@Component({
  selector: 'cv-role-switcher',
  standalone: true,
  imports: [CommonModule, CvAvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <button
        type="button"
        class="group flex items-center gap-2.5 rounded-2xl pl-1.5 pr-3 py-1.5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card hover:shadow-glow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        [class.ring-2]="open()"
        [class.ring-indigo-500]="open()"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        aria-label="Switch role"
      >
        <cv-avatar
          [name]="currentLabel()"
          [role]="activeRole()"
          size="sm"
        ></cv-avatar>
        <div class="flex flex-col items-start leading-tight">
          <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Role simulator
          </span>
          <span class="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-50">
            <span
              class="h-1.5 w-1.5 rounded-full"
              [ngClass]="dotClassFor(activeRole())"
              aria-hidden="true"
            ></span>
            {{ currentLabel() }}
          </span>
        </div>
        <svg
          class="h-4 w-4 text-slate-400 transition-transform duration-200"
          [class.rotate-180]="open()"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 0 1 1.08 1.04l-4.24 4.38a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      <div
        *ngIf="open()"
        class="absolute right-0 mt-2 w-[360px] origin-top-right rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-soft p-2 z-40 animate-scale-in"
        role="listbox"
        aria-label="Available roles"
      >
        <div class="px-3 py-2">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Switch persona
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            CareVibe is a role-aware demo. Pick a persona to see that role's dashboard, navigation, and widgets.
          </p>
        </div>
        <ul class="flex flex-col gap-0.5 max-h-[600px] cv-scrollbar overflow-y-auto">
          <li *ngFor="let r of roles">
            <button
              type="button"
              role="option"
              [attr.aria-selected]="r.id === activeRole()"
              class="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              [ngClass]="r.id === activeRole() ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30' : ''"
              (click)="select(r.id)"
            >
              <cv-avatar [name]="r.label" [role]="r.id" size="sm"></cv-avatar>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-900 dark:text-slate-50">{{ r.label }}</span>
                </div>
                <p class="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">{{ r.blurb }}</p>
              </div>
              <svg
                *ngIf="r.id === activeRole()"
                class="h-4 w-4 text-indigo-600 dark:text-indigo-400"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M16.704 5.29a1 1 0 0 1 0 1.42l-7.5 7.5a1 1 0 0 1-1.42 0l-3.5-3.5a1 1 0 0 1 1.42-1.42L8.5 12.09l6.79-6.8a1 1 0 0 1 1.414 0Z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </li>
        </ul>
      </div>
    </div>
  `,
})
export class RoleSwitcherComponent {
  private readonly roleService = inject(RoleService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly open = signal(false);
  readonly roles = ROW_LIST;
  readonly activeRole = this.roleService.activeRole;

  readonly currentLabel = computed<string>(() => ROLE_LABELS[this.roleService.activeRole()]);

  toggle(): void {
    this.open.update((v) => !v);
  }

  select(role: Role): void {
    this.roleService.setRole(role);
    this.open.set(false);
    void this.router.navigate(['/dashboard']);
  }

  dotClassFor(role: Role): string {
    // Map the gradient class (e.g. "from-rose-500 to-pink-500") to a solid dot.
    // We extract the *from-* color and return a bg-* of the same hue.
    const gradient = ROLE_COLORS[role] ?? '';
    if (gradient.includes('sky')) return 'bg-sky-500';
    if (gradient.includes('pink')) return 'bg-pink-500';
    if (gradient.includes('emerald')) return 'bg-emerald-500';
    if (gradient.includes('violet')) return 'bg-violet-500';
    if (gradient.includes('indigo')) return 'bg-indigo-500';
    if (gradient.includes('amber')) return 'bg-amber-500';
    if (gradient.includes('yellow')) return 'bg-yellow-500';
    if (gradient.includes('lime')) return 'bg-lime-500';
    if (gradient.includes('fuchsia')) return 'bg-fuchsia-500';
    return 'bg-slate-500';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.open.set(false);
  }
}
