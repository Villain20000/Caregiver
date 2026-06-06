import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';

export type CvModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<CvModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

@Component({
  selector: 'cv-modal',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('overlay', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('160ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('120ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('panel', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.96) translateY(8px)' }),
        animate(
          '220ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'scale(1) translateY(0)' }),
        ),
      ]),
      transition(':leave', [
        animate(
          '140ms ease-in',
          style({ opacity: 0, transform: 'scale(0.97) translateY(4px)' }),
        ),
      ]),
    ]),
  ],
  template: `
    <ng-container *ngIf="open">
      <div
        @overlay
        class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
        (click)="onBackdrop($event)"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title || 'Dialog'"
      >
        <div
          @panel
          class="relative w-full overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-soft"
          [ngClass]="sizeClasses"
          (click)="$event.stopPropagation()"
        >
          <header
            *ngIf="title"
            class="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800"
          >
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-50">
              {{ title }}
            </h2>
            <button
              type="button"
              class="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              (click)="close()"
              aria-label="Close dialog"
            >
              <svg
                class="h-5 w-5"
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
          </header>
          <div class="px-5 py-4 max-h-[70vh] overflow-y-auto">
            <ng-content></ng-content>
          </div>
          <footer
            *ngIf="hasFooter"
            class="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/60 dark:bg-slate-900/60"
          >
            <ng-content select="[cv-modal-footer]"></ng-content>
          </footer>
        </div>
      </div>
    </ng-container>
  `,
})
export class CvModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() size: CvModalSize = 'md';
  @Input() dismissOnBackdrop = true;
  @Input() hasFooter = false;

  @Output() closed = new EventEmitter<void>();

  get sizeClasses(): string {
    return SIZE_CLASSES[this.size];
  }

  onBackdrop(event: MouseEvent): void {
    if (!this.dismissOnBackdrop) return;
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  close(): void {
    this.open = false;
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }
}
