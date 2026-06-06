import { ChangeDetectionStrategy, Component, Input, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CvButtonVariant = 'primary' | 'ghost' | 'danger' | 'success';
export type CvButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<CvButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 active:bg-indigo-700 focus-visible:ring-indigo-500',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700 focus-visible:ring-slate-400',
  danger:
    'bg-rose-600 text-white shadow-sm hover:bg-rose-500 active:bg-rose-700 focus-visible:ring-rose-500',
  success:
    'bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 active:bg-emerald-700 focus-visible:ring-emerald-500',
};

const SIZE_CLASSES: Record<CvButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2.5 rounded-xl',
};

@Component({
  selector: 'cv-button',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [attr.aria-label]="ariaLabel || null"
      class="inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
      [ngClass]="[variantClasses, sizeClasses, fullWidth ? 'w-full' : '']"
    >
      <svg
        *ngIf="loading"
        class="h-4 w-4 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25" stroke-width="4"></circle>
        <path
          d="M22 12a10 10 0 0 1-10 10"
          stroke="currentColor"
          stroke-width="4"
          stroke-linecap="round"
        ></path>
      </svg>
      <ng-content select="[cv-btn-icon-left]"></ng-content>
      <span *ngIf="hasLabel"><ng-content></ng-content></span>
      <ng-content select="[cv-btn-icon-right]"></ng-content>
    </button>
  `,
  host: {
    class: 'inline-block',
  },
})
export class CvButtonComponent {
  @Input() variant: CvButtonVariant = 'primary';
  @Input() size: CvButtonSize = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() ariaLabel = '';
  @Input() loading = false;
  @Input({ transform: booleanAttribute }) disabled = false;
  @Input({ transform: booleanAttribute }) fullWidth = false;
  /** @deprecated kept for API compatibility with older callers. */
  @Input() icon = '';
  @Input({ transform: booleanAttribute }) hasLabel = true;

  get variantClasses(): string {
    return VARIANT_CLASSES[this.variant];
  }

  get sizeClasses(): string {
    return SIZE_CLASSES[this.size];
  }
}
