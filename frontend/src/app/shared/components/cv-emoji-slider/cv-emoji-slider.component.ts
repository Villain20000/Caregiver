import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'cv-emoji-slider',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-between gap-2" role="radiogroup" [attr.aria-label]="ariaLabel">
      <button
        *ngFor="let e of emojis; let i = index; trackBy: trackIndex"
        type="button"
        role="radio"
        [attr.aria-checked]="i === value"
        (click)="select(i)"
        class="group relative flex flex-col items-center gap-1 rounded-2xl px-2 py-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        [ngClass]="i === value
          ? 'bg-white dark:bg-slate-800 shadow-glow scale-110'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 scale-100'"
      >
        <span
          class="text-2xl leading-none transition-transform duration-200"
          [ngClass]="i === value ? 'scale-125' : 'group-hover:scale-110'"
        >{{ e }}</span>
        <span
          *ngIf="labels && labels[i]"
          class="text-[10px] font-medium uppercase tracking-wide"
          [ngClass]="i === value
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-slate-400 dark:text-slate-500'"
        >{{ labels[i] }}</span>
        <span
          *ngIf="i === value"
          class="absolute -bottom-1.5 h-1 w-6 rounded-full bg-indigo-500"
          aria-hidden="true"
        ></span>
      </button>
    </div>
  `,
})
export class CvEmojiSliderComponent {
  private readonly _value = signal(0);

  @Input() emojis: string[] = ['😞', '🙁', '😐', '🙂', '😄'];
  @Input() labels?: string[];
  @Input() ariaLabel = 'Rate how you feel';

  @Input() set value(v: number) {
    this._value.set(this.clamp(v));
  }
  get value(): number {
    return this._value();
  }

  @Output() valueChange = new EventEmitter<number>();

  select(i: number): void {
    const idx = this.clamp(i);
    if (idx === this._value()) return;
    this._value.set(idx);
    this.valueChange.emit(idx);
  }

  trackIndex = (i: number): number => i;

  private clamp(i: number): number {
    if (!isFinite(i)) return 0;
    return Math.max(0, Math.min(this.emojis.length - 1, Math.round(i)));
  }
}
