/**
 * packages/ui/src/metric-card.component.ts
 *
 * MetricCard — displays a single data point with label and optional trend.
 *
 * Usage:
 *   <app-metric-card
 *     label="Total Claims"
 *     [value]="124"
 *     [trend]="12"
 *     trendLabel="vs last month"
 *     icon="💰"
 *   />
 */
import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="metric-card">
      @if (icon()) {
        <div class="metric-icon">{{ icon() }}</div>
      }
      <div class="metric-body">
        <span class="metric-label">{{ label() }}</span>
        <span class="metric-value">{{ formattedValue() }}</span>
      </div>
      @if (trend() !== undefined && trend() !== null) {
        <div class="metric-trend" [class.trend-up]="trend()! > 0" [class.trend-down]="trend()! < 0">
          <span class="trend-arrow">{{ trend()! >= 0 ? '↑' : '↓' }}</span>
          <span class="trend-value">{{ absTrend() }}{{ trendSuffix() }}</span>
          @if (trendLabel()) {
            <span class="trend-label">{{ trendLabel() }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .metric-card {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 1.25rem;
        background: var(--color-surface, white);
        border: 1px solid var(--color-border, #e0e0e0);
        border-radius: 8px;
        transition:
          box-shadow 0.2s,
          transform 0.2s;
      }
      .metric-card:hover {
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.06));
        transform: translateY(-1px);
      }
      .metric-icon {
        font-size: 1.5rem;
        margin-bottom: 0.25rem;
      }
      .metric-body {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }
      .metric-label {
        font-size: 0.75rem;
        color: var(--color-text-muted, #9e9e9e);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
      }
      .metric-value {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--color-primary, #1a237e);
        line-height: 1.1;
      }
      .metric-trend {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        margin-top: 0.5rem;
        font-size: 0.75rem;
        flex-wrap: wrap;
      }
      .trend-up {
        color: var(--color-success, #2e7d32);
      }
      .trend-down {
        color: var(--color-error, #c62828);
      }
      .trend-arrow {
        font-weight: 700;
      }
      .trend-value {
        font-weight: 600;
      }
      .trend-label {
        color: var(--color-text-muted, #9e9e9e);
      }
    `,
  ],
})
export class MetricCardComponent {
  /** Short label for the metric. */
  readonly label = input.required<string>();

  /** Numeric value to display (or string). */
  readonly value = input.required<number | string>();

  /** Optional icon (emoji or SVG). */
  readonly icon = input<string>('');

  /** Trend value (positive = up, negative = down). */
  readonly trend = input<number | undefined>();

  /** Label for the trend (e.g. "vs last month"). */
  readonly trendLabel = input<string>('');

  /** Suffix for trend display (e.g. "%", " pts"). */
  readonly trendSuffix = input<string>('%');

  /** Format the value for display (commas for numbers). */
  readonly formattedValue = computed(() => {
    const v = this.value();
    if (typeof v === 'number') {
      return v.toLocaleString();
    }
    return v;
  });

  /** Absolute trend for display (removes sign). */
  readonly absTrend = computed(() => {
    const t = this.trend();
    if (t === undefined || t === null) return '';
    return Math.abs(t).toLocaleString();
  });
}
