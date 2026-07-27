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
