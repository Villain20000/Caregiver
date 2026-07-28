/**
 * apps/web/src/app/pages/billing/billing.component.ts
 *
 * Billing & Claims page.
 *
 * Orchestrates the billing summary, claim creation form, and claims list.
 * Handles RBAC, service calls, adjudication, and payment posting.
 */
import { Component, inject, signal, computed, type OnInit } from '@angular/core';
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
  imports: [BillingSummaryComponent, BillingCreateClaimComponent, BillingClaimsListComponent],
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
    `,
  ],
})
export class BillingComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly billingService = inject(BillingService);

  readonly claims = signal<ClaimResponse[]>([]);
  readonly summary = signal<BillingSummaryResponse | null>(null);
  readonly loading = signal(true);
  readonly processing = signal(false);
  readonly error = signal<string | null>(null);
  readonly resetTick = signal(0);

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

  onAdjudicate(claim: ClaimResponse): void {
    const amountApproved = prompt('Enter total approved amount', '0');
    const amountDenied = prompt('Enter total denied amount', '0');
    if (amountApproved === null || amountDenied === null) return;
    void this.doAdjudicate(claim, Number(amountApproved), Number(amountDenied));
  }

  private async doAdjudicate(
    claim: ClaimResponse,
    approved: number,
    denied: number,
  ): Promise<void> {
    this.error.set(null);
    try {
      const totalNet = claim.items.reduce((sum, item) => sum + (item.netAmount ?? 0), 0);
      const lineItems = claim.items.map((item) => {
        const ratio = totalNet > 0 ? (item.netAmount ?? 0) / totalNet : 1 / claim.items.length;
        return {
          serviceCode: item.serviceCode,
          amountApproved: Math.round(approved * ratio * 100) / 100,
          amountDenied: Math.round(denied * ratio * 100) / 100,
        };
      });
      const result = await this.billingService
        .adjudicateClaim(claim.id, approved > 0 ? 'adjudicated' : 'denied', lineItems)
        .toPromise();
      if (result) this.updateClaim(result);
    } catch {
      this.error.set('Failed to adjudicate claim.');
    }
  }

  onPayment(claim: ClaimResponse): void {
    const amount = prompt('Enter payment amount', String(claim.amountApproved ?? 0));
    if (amount === null) return;
    void this.doPayment(claim, Number(amount));
  }

  private async doPayment(claim: ClaimResponse, amount: number): Promise<void> {
    this.error.set(null);
    try {
      const today = new Date().toISOString().split('T')[0] ?? '';
      const result = await this.billingService
        .postPayment(claim.id, amount, today, 'check')
        .toPromise();
      if (result) this.updateClaim(result);
    } catch {
      this.error.set('Failed to post payment.');
    }
  }

  private updateClaim(updated: ClaimResponse): void {
    this.claims.update((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }
}
