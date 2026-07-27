/**
 * apps/web/src/app/services/billing.service.ts
 *
 * Angular service for insurance claim and payment operations.
 *
 * Wraps the /api/billing endpoints for creating, submitting, adjudicating,
 * and paying claims, plus retrieving aggregate billing summaries.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { ClaimResponse, CreateClaimRequest, BillingSummaryResponse } from '@caregiver/contracts';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);

  /**
   * Create a new insurance claim.
   *
   * @param req - Claim creation payload.
   * @returns Observable emitting the created claim.
   */
  createClaim(req: CreateClaimRequest) {
    return this.http.post<ClaimResponse>('/api/billing/claims', req);
  }

  /**
   * Submit a draft claim to the insurer.
   *
   * @param id - Id of the claim to submit.
   * @param submittedBy - Id of the user submitting the claim.
   * @returns Observable emitting the updated claim.
   */
  submitClaim(id: string, submittedBy: string) {
    return this.http.post<ClaimResponse>(`/api/billing/claims/${id}/submit`, { submittedBy });
  }

  /**
   * Adjudicate a submitted claim.
   *
   * @param claimId - Id of the claim to adjudicate.
   * @param outcome - Adjudication outcome (e.g. "adjudicated" or "denied").
   * @param lineItems - Line item-level approved/denied amounts.
   * @returns Observable emitting the updated claim.
   */
  adjudicateClaim(
    claimId: string,
    outcome: string,
    lineItems: Array<{ serviceCode: string; amountApproved: number; amountDenied: number }>,
  ) {
    return this.http.post<ClaimResponse>('/api/billing/adjudicate', { claimId, outcome, lineItems });
  }

  /**
   * Post a payment against a claim.
   *
   * @param claimId - Id of the claim being paid.
   * @param amount - Payment amount.
   * @param paymentDate - ISO date of the payment.
   * @param paymentMethod - Payment method (e.g. "check").
   * @returns Observable emitting the updated claim.
   */
  postPayment(claimId: string, amount: number, paymentDate: string, paymentMethod: string) {
    return this.http.post<ClaimResponse>('/api/billing/payments', { claimId, amount, paymentDate, paymentMethod });
  }

  /**
   * List all claims the current user is allowed to see.
   *
   * @returns Observable emitting the list of claims.
   */
  listClaims() {
    return this.http.get<ClaimResponse[]>('/api/billing/claims');
  }

  /**
   * Retrieve a single claim by id.
   *
   * @param id - Claim id.
   * @returns Observable emitting the claim.
   */
  getClaim(id: string) {
    return this.http.get<ClaimResponse>(`/api/billing/claims/${id}`);
  }

  /**
   * Fetch aggregate billing statistics.
   *
   * @returns Observable emitting the billing summary.
   */
  getSummary() {
    return this.http.get<BillingSummaryResponse>('/api/billing/summary');
  }
}
