/**
 * packages/ui/src/loading-spinner.component.ts
 *
 * LoadingSpinner — animated spinner with optional label text.
 *
 * Usage:
 *   <app-loading-spinner />
 *   <app-loading-spinner label="Loading appointments..." />
 *   <app-loading-spinner [size]="'lg'" />
 */
import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SpinnerSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-container" [class]="'size-' + size()">
      <div class="spinner" [class]="'spinner-' + size()"></div>
      @if (label()) {
        <span class="loading-label">{{ label() }}</span>
      }
    </div>
  `,
  styles: [
    `
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 2rem;
      }
      .spinner {
        border-radius: 50%;
        border: 3px solid var(--color-border);
        border-top-color: var(--color-primary);
        animation: spin 0.6s linear infinite;
      }
      .spinner-sm {
        width: 16px;
        height: 16px;
        border-width: 2px;
      }
      .spinner-md {
        width: 24px;
        height: 24px;
        border-width: 3px;
      }
      .spinner-lg {
        width: 36px;
        height: 36px;
        border-width: 4px;
      }
      .loading-label {
        font-size: var(--text-sm, 0.875rem);
        color: var(--color-text-muted, #9e9e9e);
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class LoadingSpinnerComponent {
  /** Optional label text shown below the spinner. */
  readonly label = input<string>('');

  /** Spinner size variant. */
  readonly size = input<SpinnerSize>('md');
}
