import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastTone } from '../../../core/services/toast.service';

interface ToneClasses {
  container: string;
  icon: string;
  iconPath: string;
}

const TONE_MAP: Record<ToastTone, ToneClasses> = {
  info: {
    container:
      'border-sky-200/60 bg-white text-slate-900 dark:bg-slate-900 dark:border-sky-500/30 dark:text-slate-50',
    icon: 'text-sky-500 bg-sky-50 dark:bg-sky-500/10',
    iconPath:
      'M12 8v4m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  },
  success: {
    container:
      'border-emerald-200/60 bg-white text-slate-900 dark:bg-slate-900 dark:border-emerald-500/30 dark:text-slate-50',
    icon: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10',
    iconPath: 'M5 13l4 4L19 7',
  },
  warning: {
    container:
      'border-amber-200/60 bg-white text-slate-900 dark:bg-slate-900 dark:border-amber-500/30 dark:text-slate-50',
    icon: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10',
    iconPath:
      'M12 9v3.75M12 17.25h.008v.008H12v-.008ZM10.34 4.34a1.875 1.875 0 0 1 3.32 0l7.81 13.26A1.875 1.875 0 0 1 19.81 21H4.19a1.875 1.875 0 0 1-1.66-3.4l7.81-13.26Z',
  },
  danger: {
    container:
      'border-rose-200/60 bg-white text-slate-900 dark:bg-slate-900 dark:border-rose-500/30 dark:text-slate-50',
    icon: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10',
    iconPath:
      'M12 9v3.75M12 16.5h.008v.008H12v-.008ZM10.34 4.34a1.875 1.875 0 0 1 3.32 0l7.81 13.26A1.875 1.875 0 0 1 19.81 21H4.19a1.875 1.875 0 0 1-1.66-3.4l7.81-13.26Z',
  },
};

@Component({
  selector: 'cv-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="pointer-events-none fixed top-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        *ngFor="let t of toasts(); trackBy: trackId"
        class="pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-soft backdrop-blur animate-toast-in"
        [ngClass]="classesFor(t.tone).container"
        role="status"
      >
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          [ngClass]="classesFor(t.tone).icon"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path [attr.d]="classesFor(t.tone).iconPath"></path>
          </svg>
        </div>
        <p class="flex-1 text-sm leading-relaxed">{{ t.message }}</p>
        <button
          type="button"
          class="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          (click)="dismiss(t.id)"
          aria-label="Dismiss notification"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  `,
})
export class CvToastContainerComponent {
  private readonly toastService = inject(ToastService);

  readonly toasts = this.toastService.toasts;

  trackId = (_: number, t: { id: number }): number => t.id;

  classesFor(tone: ToastTone): ToneClasses {
    return TONE_MAP[tone];
  }

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
