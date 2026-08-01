/**
 * packages/ui/src/status-badge.component.ts
 *
 * StatusBadge — displays a status/state with semantic color coding.
 *
 * Usage:
 *   <app-status-badge [status]="'completed'" />
 *   <app-status-badge [status]="'active'" [size]="'sm'" />
 *
 * Status colors are driven by the global CSS status-badge classes.
 * Supported status groups: completed/fulfilled/adjudicated (green),
 * pending/submitted (orange), cancelled/denied (red), draft (blue).
 */
import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeSize = 'sm' | 'md';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="status-badge"
      [class]="status()"
      [class.badge-sm]="size() === 'sm'"
      [class.badge-md]="size() === 'md'"
    >
      {{ status() }}
    </span>
  `,
  styles: [
    `
      .status-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.15rem 0.5rem;
        border-radius: 9999px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
        background: var(--color-info-bg);
        color: var(--color-info);
      }
      .badge-sm {
        font-size: 0.65rem;
        padding: 0.1rem 0.4rem;
      }
      .badge-md {
        font-size: 0.7rem;
        padding: 0.15rem 0.5rem;
      }
      /* Semantic states mapped via class */
      .status-badge.active,
      .status-badge.booked,
      .status-badge.draft,
      .status-badge.requested,
      .status-badge.proposed {
        background: var(--color-info-bg);
        color: var(--color-info);
      }
      .status-badge.completed,
      .status-badge.fulfilled,
      .status-badge.adjudicated,
      .status-badge.paid,
      .status-badge.approved,
      .status-badge.valid {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .status-badge.cancelled,
      .status-badge.denied,
      .status-badge.failed,
      .status-badge[class*='entered-in-error'],
      .status-badge.invalid {
        background: var(--color-error-bg);
        color: var(--color-error);
      }
      .status-badge.pending,
      .status-badge.submitted,
      .status-badge.processing {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
      .status-badge.partial,
      .status-badge.arrived {
        background: #fff8e1;
        color: #f57f17;
      }
    `,
  ],
})
export class StatusBadgeComponent {
  /** The status value to display. */
  readonly status = input.required<string>();

  /** Badge size variant. */
  readonly size = input<BadgeSize>('md');
}
