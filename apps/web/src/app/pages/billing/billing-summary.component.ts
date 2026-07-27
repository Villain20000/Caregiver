/**
 * apps/web/src/app/pages/billing/billing-summary.component.ts
 *
 * Displays aggregate billing statistics as a card grid.
 */
import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { BillingSummaryResponse } from '@caregiver/contracts';

@Component({
  selector: 'app-billing-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (summary(); as s) {
      <div class="summary-grid">
        <div class="summary-card"><strong>{{ s.totalClaims }}</strong><span>Total Claims</span></div>
        <div class="summary-card"><strong>\${{ s.totalBilled | number }}</strong><span>Total Billed</span></div>
        <div class="summary-card"><strong>\${{ s.totalPaid | number }}</strong><span>Total Paid</span></div>
        <div class="summary-card"><strong>{{ (s.denialRate ?? 0) | percent }}</strong><span>Denial Rate</span></div>
      </div>
    }
  `,
  styles: [`
    .summary-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1.5rem;
    }
    .summary-card {
      padding: 1rem; background: white; border: 1px solid #e0e0e0; border-radius: 8px;
      text-align: center;
    }
    .summary-card strong { display: block; font-size: 1.5rem; color: #1a237e; }
    .summary-card span { font-size: 0.75rem; color: #666; text-transform: uppercase; }
  `],
})
export class BillingSummaryComponent {
  /** Aggregate billing statistics, or null when not yet loaded. */
  readonly summary = input<BillingSummaryResponse | null>(null);
}
