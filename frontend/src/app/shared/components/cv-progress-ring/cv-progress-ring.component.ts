import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cv-progress-ring',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-flex items-center justify-center" [style.width.px]="size" [style.height.px]="size">
      <svg [attr.width]="size" [attr.height]="size" class="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient [attr.id]="gradientId" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" [attr.stop-color]="color" stop-opacity="0.9"></stop>
            <stop offset="100%" [attr.stop-color]="color" stop-opacity="0.55"></stop>
          </linearGradient>
        </defs>
        <circle
          [attr.cx]="center"
          [attr.cy]="center"
          [attr.r]="radius"
          fill="none"
          class="stroke-slate-200 dark:stroke-slate-800"
          [attr.stroke-width]="stroke"
        ></circle>
        <circle
          [attr.cx]="center"
          [attr.cy]="center"
          [attr.r]="radius"
          fill="none"
          [attr.stroke]="'url(#' + gradientId + ')'"
          [attr.stroke-width]="stroke"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference"
          [attr.stroke-dashoffset]="dashOffset"
          class="transition-[stroke-dashoffset] duration-700 ease-out"
        ></circle>
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span class="font-mono text-lg font-semibold text-slate-900 dark:text-slate-50 tabular-nums">
          {{ clamped }}<span *ngIf="showPercent" class="text-xs text-slate-500 dark:text-slate-400">%</span>
        </span>
        <span *ngIf="label" class="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {{ label }}
        </span>
      </div>
    </div>
  `,
})
export class CvProgressRingComponent {
  private readonly _value = signal(0);
  private readonly _uid = Math.random().toString(36).slice(2, 9);

  @Input() set value(v: number) {
    this._value.set(isFinite(v) ? v : 0);
  }
  get value(): number {
    return this._value();
  }

  // Backward-compatible aliases (used by other feature components)
  @Input() set percent(v: number) {
    this.value = v;
  }

  @Input() set strokeWidth(v: number) {
    if (isFinite(v) && v > 0) this.stroke = v;
  }

  @Input() size = 96;
  @Input() stroke = 10;
  @Input() color = '#4f46e5';
  @Input() label = '';
  @Input() showPercent = true;

  get radius(): number {
    return (this.size - this.stroke) / 2;
  }

  get center(): number {
    return this.size / 2;
  }

  get circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  get clamped(): number {
    return Math.max(0, Math.min(100, Math.round(this._value())));
  }

  get dashOffset(): number {
    return this.circumference - (this.clamped / 100) * this.circumference;
  }

  get gradientId(): string {
    return `cv-ring-grad-${this._uid}`;
  }
}
