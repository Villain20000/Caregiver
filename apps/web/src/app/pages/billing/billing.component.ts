/**
 * apps/web/src/app/pages/billing/billing.component.ts
 *
 * Billing & Claims page — the main orchestrator component.
 *
 * 📝 Angular Concepts Demonstrated:
 *   - **Standalone component** with child component composition
 *   - **Input/Output** pattern with child components
 *   - **Computed signals** for role-based feature visibility
 *   - **Signals** for claims list, summary, loading, error state
 *   - **@if/@for** template control flow
 *   - **Child components** via @Component.imports
 *
 * Component hierarchy:
 *   BillingComponent (orchestrator)
 *     ├── BillingSummaryComponent  (stats cards)
 *     ├── BillingCreateClaimComponent (form)
 *     └── BillingClaimsListComponent (table + actions)
 *
 * Orchestrates the billing summary, claim creation form, and claims list.
 * Handles RBAC, service calls, adjudication, and payment posting.
 */
import { Component, inject, signal, computed, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service.js';
import { BillingService } from '../../services/billing.service.js';
import type {
  ClaimResponse,
  CreateClaimRequest,
  BillingSummaryResponse,
} from '@caregiver/contracts';
import { BillingSummaryComponent } from './billing-summary.component.js';
import { BillingCreateClaimComponent } from './billing-create-claim.component.js';
import { BillingClaimsListComponent } from './billing-claims-list.component.js';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BillingSummaryComponent,
    BillingCreateClaimComponent,
    BillingClaimsListComponent,
  ],
  template: `
    <div class="page">
      <h1>Billing & Claims</h1>
      <p class="page-subtitle">Manage claims, adjudication, and payments.</p>

      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <app-billing-summary [summary]="summary()" />

      @if (canCreateClaim()) {
        <app-billing-create-claim
          [processing]="processing()"
          [resetTick]="resetTick()"
          (createClaim)="onCreateClaim($event)"
        />
      }

      <app-billing-claims-list
        [claims]="claims()"
        [loading]="loading()"
        [canSubmitPay]="canSubmitPay()"
        [canAdjudicate]="canAdjudicate()"
        (submitClaim)="onSubmitClaim($event)"
        (adjudicate)="onAdjudicate($event)"
        (pay)="onPayment($event)"
      />

      @if (showAdjudicationForm()) {
        <!-- Inline adjudication form — replace prompt dialogs -->
        <div class="form-section inline-form">
          <h3>Adjudicate Claim</h3>
          <p class="inline-form-subtitle">Enter approved and denied amounts for this claim.</p>
          <form [formGroup]="adjudicationForm" (ngSubmit)="submitAdjudication()">
            <div class="form-row">
              <div class="form-field">
                <label for="approvedAmount">Total Approved Amount ($)</label>
                <input
                  id="approvedAmount"
                  type="number"
                  formControlName="approvedAmount"
                  placeholder="0.00"
                />
              </div>
              <div class="form-field">
                <label for="deniedAmount">Total Denied Amount ($)</label>
                <input
                  id="deniedAmount"
                  type="number"
                  formControlName="deniedAmount"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" [disabled]="processingAdjudication()" class="primary-btn">
                {{ processingAdjudication() ? 'Processing...' : 'Submit Adjudication' }}
              </button>
              <button type="button" (click)="cancelAdjudicate()" class="secondary-btn">
                Cancel
              </button>
            </div>
          </form>
        </div>
      }

      @if (showPaymentForm()) {
        <!-- Inline payment form — replace prompt dialogs -->
        <div class="form-section inline-form">
          <h3>Post Payment</h3>
          <p class="inline-form-subtitle">Enter the payment amount and method.</p>
          <form [formGroup]="paymentForm" (ngSubmit)="submitPayment()">
            <div class="form-row">
              <div class="form-field">
                <label for="paymentAmount">Payment Amount ($)</label>
                <input
                  id="paymentAmount"
                  type="number"
                  formControlName="amount"
                  placeholder="0.00"
                />
              </div>
              <div class="form-field">
                <label for="paymentMethod">Payment Method</label>
                <select id="paymentMethod" formControlName="paymentMethod">
                  <option value="check">Check</option>
                  <option value="electronic">Electronic</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="wire">Wire Transfer</option>
                </select>
              </div>
              <div class="form-field">
                <label for="paymentDate">Payment Date</label>
                <input id="paymentDate" type="date" formControlName="paymentDate" />
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" [disabled]="processingPayment()" class="primary-btn">
                {{ processingPayment() ? 'Posting...' : 'Post Payment' }}
              </button>
              <button type="button" (click)="cancelPay()" class="secondary-btn">Cancel</button>
            </div>
          </form>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 1200px;
        margin: 0 auto;
      }
      h1 {
        color: #1a237e;
        margin-bottom: 0.25rem;
      }
      .page-subtitle {
        color: #666;
        margin-top: 0;
      }
      .error-banner {
        margin-top: 1rem;
        padding: 0.75rem;
        background: #ffebee;
        border: 1px solid #ef9a9a;
        border-radius: 4px;
        color: #c62828;
        font-size: 0.875rem;
      }
      .inline-form {
        margin-top: 1.5rem;
        border: 2px solid #1a237e;
      }
      .inline-form h3 {
        margin: 0 0 0.25rem;
        color: #1a237e;
        font-size: 1rem;
      }
      .inline-form-subtitle {
        margin: 0 0 1rem;
        color: #666;
        font-size: 0.85rem;
      }
      .form-row {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .form-field {
        flex: 1;
      }
      .form-field label {
        display: block;
        margin-bottom: 0.3rem;
        font-size: 0.8rem;
        font-weight: 500;
      }
      .form-field input,
      .form-field select {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
      }
      .form-actions {
        display: flex;
        gap: 0.75rem;
      }
      .primary-btn {
        padding: 0.6rem 1.5rem;
        background: #1a237e;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .primary-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .secondary-btn {
        padding: 0.6rem 1.5rem;
        background: #f5f5f5;
        color: #333;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
      }
    `,
  ],
})
export class BillingComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly billingService = inject(BillingService);
  private readonly fb = inject(FormBuilder);

  // ── Data signals ─────────────────────────────────────────────
  readonly claims = signal<ClaimResponse[]>([]);
  readonly summary = signal<BillingSummaryResponse | null>(null);
  readonly loading = signal(true);
  readonly processing = signal(false);
  readonly error = signal<string | null>(null);
  readonly resetTick = signal(0);

  // ── Inline form visibility ───────────────────────────────────
  readonly adjudicatingClaimId = signal<string | null>(null);
  readonly payingClaimId = signal<string | null>(null);
  readonly processingAdjudication = signal(false);
  readonly processingPayment = signal(false);

  // Computed booleans for template visibility
  readonly showAdjudicationForm = computed(() => this.adjudicatingClaimId() !== null);
  readonly showPaymentForm = computed(() => this.payingClaimId() !== null);

  // ── Adjudication form ────────────────────────────────────────
  readonly adjudicationForm = this.fb.nonNullable.group({
    approvedAmount: this.fb.nonNullable.control<number>(0, [
      Validators.required,
      Validators.min(0),
    ]),
    deniedAmount: this.fb.nonNullable.control<number>(0, [Validators.required, Validators.min(0)]),
  });

  // ── Payment form ─────────────────────────────────────────────
  readonly paymentForm = this.fb.nonNullable.group({
    amount: this.fb.nonNullable.control<number>(0, [Validators.required, Validators.min(0.01)]),
    paymentMethod: this.fb.nonNullable.control<'check' | 'electronic' | 'credit_card' | 'wire'>(
      'check',
      [Validators.required],
    ),
    paymentDate: ['', [Validators.required]],
  });

  // ── RBAC computed signals ────────────────────────────────────
  readonly canCreateClaim = computed(() => {
    const role = this.authService.userRole();
    return (
      role === 'admin' ||
      role === 'pharmacist' ||
      role === 'billing_specialist' ||
      role === 'medical_director'
    );
  });

  readonly canSubmitPay = computed(() => {
    const role = this.authService.userRole();
    return role === 'admin' || role === 'billing_specialist';
  });

  readonly canAdjudicate = computed(() => {
    const role = this.authService.userRole();
    return role === 'admin' || role === 'billing_specialist' || role === 'medical_director';
  });

  ngOnInit(): void {
    this.loadClaims();
    this.loadSummary();
  }

  // ── Data loading ─────────────────────────────────────────────
  private async loadClaims(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const claims = await this.billingService.listClaims().toPromise();
      this.claims.set(claims ?? []);
    } catch {
      this.error.set('Failed to load claims.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSummary(): Promise<void> {
    try {
      const summary = await this.billingService.getSummary().toPromise();
      if (summary) this.summary.set(summary);
    } catch {
      // summary is non-critical
    }
  }

  // ── Claim creation ───────────────────────────────────────────
  async onCreateClaim(request: CreateClaimRequest): Promise<void> {
    this.processing.set(true);
    this.error.set(null);
    try {
      const result = await this.billingService.createClaim(request).toPromise();
      if (result) {
        this.claims.update((prev) => [result, ...prev]);
        this.resetTick.update((tick) => tick + 1);
        await this.loadSummary();
      }
    } catch {
      this.error.set('Failed to create claim.');
    } finally {
      this.processing.set(false);
    }
  }

  // ── Submit ───────────────────────────────────────────────────
  async onSubmitClaim(id: string): Promise<void> {
    this.error.set(null);
    try {
      const userId = this.authService.currentUser()?.id ?? '';
      const result = await this.billingService.submitClaim(id, userId).toPromise();
      if (result) this.updateClaim(result);
    } catch {
      this.error.set('Failed to submit claim.');
    }
  }

  // ── Adjudication (inline form) ───────────────────────────────
  /**
   * Show the inline adjudication form for the given claim.
   * Pre-populates the form with the claim's total as the approved amount.
   */
  onAdjudicate(claim: ClaimResponse): void {
    const totalAmount = Math.round(claim.totalAmount * 100) / 100;
    this.adjudicationForm.setValue({
      approvedAmount: totalAmount,
      deniedAmount: 0,
    });
    this.adjudicatingClaimId.set(claim.id);
  }

  /** Cancel adjudication and hide the form. */
  cancelAdjudicate(): void {
    this.adjudicatingClaimId.set(null);
  }

  /** Submit the inline adjudication form. */
  async submitAdjudication(): Promise<void> {
    if (this.adjudicationForm.invalid) return;

    const claimId = this.adjudicatingClaimId();
    const claim = this.claims().find((c) => c.id === claimId);
    if (!claim) return;

    const { approvedAmount, deniedAmount } = this.adjudicationForm.getRawValue();

    this.processingAdjudication.set(true);
    this.error.set(null);
    try {
      const totalNet = claim.items.reduce((sum, item) => sum + (item.netAmount ?? 0), 0);
      const lineItems = claim.items.map((item) => {
        const ratio = totalNet > 0 ? (item.netAmount ?? 0) / totalNet : 1 / claim.items.length;
        return {
          serviceCode: item.serviceCode,
          amountApproved: Math.round(approvedAmount * ratio * 100) / 100,
          amountDenied: Math.round(deniedAmount * ratio * 100) / 100,
        };
      });
      const result = await this.billingService
        .adjudicateClaim(claim.id, approvedAmount > 0 ? 'adjudicated' : 'denied', lineItems)
        .toPromise();
      if (result) {
        this.updateClaim(result);
        this.adjudicatingClaimId.set(null);
      }
    } catch {
      this.error.set('Failed to adjudicate claim.');
    } finally {
      this.processingAdjudication.set(false);
    }
  }

  // ── Payment (inline form) ────────────────────────────────────
  /**
   * Show the inline payment form for the given claim.
   * Pre-populates with the approved amount (or total) and today's date.
   */
  onPayment(claim: ClaimResponse): void {
    const suggestedAmount = claim.amountApproved ?? claim.totalAmount;
    const today = new Date().toISOString().split('T')[0] ?? '';
    this.paymentForm.setValue({
      amount: Math.round(suggestedAmount * 100) / 100,
      paymentMethod: 'check',
      paymentDate: today,
    });
    this.payingClaimId.set(claim.id);
  }

  /** Cancel payment and hide the form. */
  cancelPay(): void {
    this.payingClaimId.set(null);
  }

  /** Submit the inline payment form. */
  async submitPayment(): Promise<void> {
    if (this.paymentForm.invalid) return;

    const claimId = this.payingClaimId();
    if (!claimId) return;

    const { amount, paymentMethod, paymentDate } = this.paymentForm.getRawValue();

    this.processingPayment.set(true);
    this.error.set(null);
    try {
      const result = await this.billingService
        .postPayment(claimId, amount, paymentDate, paymentMethod)
        .toPromise();
      if (result) {
        this.updateClaim(result);
        this.payingClaimId.set(null);
      }
    } catch {
      this.error.set('Failed to post payment.');
    } finally {
      this.processingPayment.set(false);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────
  private updateClaim(updated: ClaimResponse): void {
    this.claims.update((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }
}
