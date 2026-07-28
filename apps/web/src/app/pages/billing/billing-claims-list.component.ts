/**
 * apps/web/src/app/pages/billing/billing-claims-list.component.ts
 *
 * Claims list component.
 *
 * Renders insurance claims and exposes role- and status-conditional actions:
 * submit, adjudicate, and post payment.
 */
import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ClaimResponse } from '@caregiver/contracts';

@Component({
  selector: 'app-billing-claims-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="history-section">
      <h2>Claims</h2>
      @if (loading()) {
        <div class="loading">Loading claims...</div>
      }
      @if (!loading() && claims().length > 0) {
        <div class="claim-list">
          @for (c of claims(); track c.id) {
            <div class="claim-card">
              <div class="claim-header">
                <span class="claim-type">{{ c.type }} / {{ c.use }}</span>
                <span class="claim-status" [class]="c.status">{{ c.status }}</span>
                <span class="claim-amount">\${{ c.totalAmount | number }}</span>
              </div>
              <div class="claim-body">
                <p><strong>Patient:</strong> {{ c.patientId }}</p>
                <p><strong>Provider:</strong> {{ c.providerId }}</p>
                <p><strong>Insurer:</strong> {{ c.insurerId }}</p>
                @if (c.amountApproved !== undefined) {
                  <p><strong>Approved:</strong> \${{ c.amountApproved | number }}</p>
                }
                @if (c.amountPaid !== undefined) {
                  <p><strong>Paid:</strong> \${{ c.amountPaid | number }}</p>
                }
              </div>
              <div class="claim-actions">
                @if (c.status === 'draft' && canSubmitPay()) {
                  <button (click)="submitClaim.emit(c.id)" class="action-btn">Submit</button>
                }
                @if ((c.status === 'submitted' || c.status === 'pending') && canAdjudicate()) {
                  <button (click)="adjudicate.emit(c)" class="action-btn">Adjudicate</button>
                }
                @if ((c.status === 'adjudicated' || c.status === 'partial') && canSubmitPay()) {
                  <button (click)="pay.emit(c)" class="action-btn">Post Payment</button>
                }
              </div>
            </div>
          }
        </div>
      }
      @if (!loading() && claims().length === 0) {
        <div class="empty-state">No claims found.</div>
      }
    </div>
  `,
  styles: [
    `
      .history-section {
        margin-top: 1.5rem;
        padding: 1.5rem;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
      }
      h2 {
        margin-top: 0;
        color: #333;
        font-size: 1.1rem;
      }
      .loading,
      .empty-state {
        text-align: center;
        color: #999;
        padding: 1rem;
      }
      .claim-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      .claim-card {
        padding: 1rem;
        background: #f5f5f5;
        border-radius: 6px;
      }
      .claim-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
        flex-wrap: wrap;
      }
      .claim-type {
        font-weight: 600;
        color: #1a237e;
        text-transform: uppercase;
        font-size: 0.75rem;
      }
      .claim-amount {
        margin-left: auto;
        font-weight: 600;
      }
      .claim-status {
        padding: 0.15rem 0.4rem;
        border-radius: 4px;
        font-size: 0.7rem;
        text-transform: uppercase;
        font-weight: 600;
      }
      .claim-status.draft {
        background: #f5f5f5;
        color: #666;
      }
      .claim-status.submitted {
        background: #fff3e0;
        color: #e65100;
      }
      .claim-status.pending {
        background: #e3f2fd;
        color: #1565c0;
      }
      .claim-status.adjudicated {
        background: #e8f5e9;
        color: #2e7d32;
      }
      .claim-status.partial {
        background: #fff8e1;
        color: #f57f17;
      }
      .claim-status.denied {
        background: #ffebee;
        color: #c62828;
      }
      .claim-status.paid {
        background: #e8f5e9;
        color: #1b5e20;
      }
      .claim-body p {
        margin: 0.25rem 0;
        font-size: 0.875rem;
      }
      .claim-actions {
        margin-top: 0.75rem;
        display: flex;
        gap: 0.5rem;
      }
      .action-btn {
        padding: 0.3rem 0.7rem;
        border: 1px solid #1a237e;
        background: white;
        color: #1a237e;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
      }
    `,
  ],
})
export class BillingClaimsListComponent {
  /** Claims to display. */
  readonly claims = input.required<ClaimResponse[]>();
  /** True while the parent is loading data. */
  readonly loading = input<boolean>(false);
  /** Whether Submit / Post Payment actions should be shown. */
  readonly canSubmitPay = input<boolean>(false);
  /** Whether Adjudicate actions should be shown. */
  readonly canAdjudicate = input<boolean>(false);

  /** Emits the id of the claim to submit. */
  readonly submitClaim = output<string>();
  /** Emits the claim to adjudicate. */
  readonly adjudicate = output<ClaimResponse>();
  /** Emits the claim to pay. */
  readonly pay = output<ClaimResponse>();
}
