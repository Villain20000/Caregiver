/**
 * packages/contracts/src/events/billing-events.ts
 *
 * Event payload types for billing/claim lifecycle events.
 *
 * Topics:
 *   - claim.created      → new insurance claim created
 *   - claim.submitted    → claim sent to insurer
 *   - claim.adjudicated  → insurer responded (approved/denied)
 *   - payment.posted     → payment received and posted
 */

/** Payload for `claim.created` — a new insurance claim was created. */
export interface ClaimCreatedPayload {
  claimId: string;
  patientId: string;
  providerId: string;
  insurerId: string;
  type: string;
  use: string;
  totalAmount: number;
}

export interface ClaimSubmittedPayload {
  claimId: string;
  submittedBy: string;
  submittedAt: string;
}

export interface ClaimAdjudicatedPayload {
  claimId: string;
  outcome: string;
  totalApproved: number;
  totalDenied: number;
}

export interface PaymentPostedPayload {
  claimId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
}
