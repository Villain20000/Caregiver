/**
 * packages/ui/src/empty-state.component.ts
 *
 * EmptyState — displays a placeholder when there is no data to show.
 *
 * Usage:
 *   <app-empty-state
 *     icon="📋"
 *     title="No appointments found"
 *     description="Schedule your first appointment to get started."
 *   />
 *
 * The `icon` slot uses an emoji or SVG string. The component is fully
 * presentational and reusable across all feature pages.
 */
import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state">
      @if (icon()) {
        <div class="empty-icon">{{ icon() }}</div>
      }
      <h3 class="empty-title">{{ title() }}</h3>
      @if (description()) {
        <p class="empty-description">{{ description() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: [
    `
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3rem 2rem;
        text-align: center;
        gap: 0.5rem;
      }
      .empty-icon {
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
        opacity: 0.6;
      }
      .empty-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-secondary, #666);
      }
      .empty-description {
        margin: 0;
        font-size: 0.875rem;
        color: var(--color-text-muted, #9e9e9e);
        max-width: 300px;
        line-height: 1.5;
      }
    `,
  ],
})
export class EmptyStateComponent {
  /** Optional emoji or SVG icon to display. */
  readonly icon = input<string>('');

  /** Title text for the empty state. */
  readonly title = input<string>('');

  /** Optional description text. */
  readonly description = input<string>('');
}
