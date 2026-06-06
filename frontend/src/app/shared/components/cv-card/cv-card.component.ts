import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CvCardPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING_CLASSES: Record<CvCardPadding, string> = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

@Component({
  selector: 'cv-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200/60 dark:border-slate-800 shadow-card transition-shadow hover:shadow-soft"
      [ngClass]="[padding === 'none' ? '' : paddingClasses]"
    >
      <header
        *ngIf="title || subtitle"
        class="flex items-start justify-between gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/70"
      >
        <div class="min-w-0">
          <h3
            *ngIf="title"
            class="text-base font-semibold text-slate-900 dark:text-slate-50 truncate"
          >
            {{ title }}
          </h3>
          <p
            *ngIf="subtitle"
            class="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate"
          >
            {{ subtitle }}
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <ng-content select="[cv-card-actions]"></ng-content>
        </div>
      </header>
      <div [ngClass]="padding === 'none' ? paddingClasses : ''">
        <ng-content></ng-content>
      </div>
      <footer
        *ngIf="hasFooter"
        class="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/70"
      >
        <ng-content select="[cv-card-footer]"></ng-content>
      </footer>
    </section>
  `,
})
export class CvCardComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() padding: CvCardPadding = 'md';
  @Input() hasFooter = false;

  get paddingClasses(): string {
    return PADDING_CLASSES[this.padding];
  }
}
