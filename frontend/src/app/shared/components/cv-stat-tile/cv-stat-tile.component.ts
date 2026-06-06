import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CvStatTone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary' | 'info';

const TONE_TEXT: Record<CvStatTone, string> = {
  neutral: 'text-slate-600 dark:text-slate-300',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-rose-600 dark:text-rose-400',
  primary: 'text-indigo-600 dark:text-indigo-400',
  info: 'text-sky-600 dark:text-sky-400',
};

const TONE_BG: Record<CvStatTone, string> = {
  neutral:
    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  success:
    'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  warning:
    'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  danger: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
  primary:
    'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
  info: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
};

@Component({
  selector: 'cv-stat-tile',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="group relative overflow-hidden rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200/60 dark:border-slate-800 shadow-card p-5 transition-all hover:shadow-soft"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {{ label }}
          </p>
          <p class="mt-2 text-3xl font-bold font-mono text-slate-900 dark:text-slate-50 tracking-tight">
            {{ value }}
          </p>
        </div>
        <div
          *ngIf="icon"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          [ngClass]="iconBgClass"
          aria-hidden="true"
        >
          <ng-content select="[cv-stat-icon]"></ng-content>
          <span *ngIf="!hasIconContent" class="text-xl leading-none flex items-center justify-center h-6 w-6 select-none">{{ icon }}</span>
        </div>
      </div>

      <div class="mt-3 flex items-center gap-2 text-xs">
        <span
          *ngIf="trend !== undefined && trend !== null"
          class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
          [ngClass]="trendBadgeClass"
        >
          <svg
            class="h-3 w-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <ng-container *ngIf="trend >= 0; else down">
              <path d="M3 8l3-3 3 3"></path>
              <path d="M6 5v6"></path>
            </ng-container>
            <ng-template #down>
              <path d="M3 4l3 3 3-3"></path>
              <path d="M6 7V1"></path>
            </ng-template>
          </svg>
          {{ trend >= 0 ? '+' : '' }}{{ trend | number: '1.0-1' }}%
        </span>
        <span *ngIf="sub" class="text-slate-500 dark:text-slate-400 truncate">
          {{ sub }}
        </span>
      </div>

      <div
        class="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        [ngClass]="glowClass"
        aria-hidden="true"
      ></div>
    </div>
  `,
})
export class CvStatTileComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() icon = '';
  @Input() trend?: number | null;
  @Input() sub = '';
  @Input() tone: CvStatTone = 'neutral';
  /** When true, the projected icon is used and the text fallback is hidden. */
  @Input() hasIconContent = false;

  get iconBgClass(): string {
    return TONE_BG[this.tone];
  }

  get trendBadgeClass(): string {
    if (this.trend === undefined || this.trend === null) return TONE_BG['neutral'];
    return this.trend >= 0
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
      : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400';
  }

  get glowClass(): string {
    switch (this.tone) {
      case 'primary':
        return 'bg-indigo-500/10 blur-2xl';
      case 'success':
        return 'bg-emerald-500/10 blur-2xl';
      case 'warning':
        return 'bg-amber-500/10 blur-2xl';
      case 'danger':
        return 'bg-rose-500/10 blur-2xl';
      default:
        return 'bg-slate-500/10 blur-2xl';
    }
  }
}
