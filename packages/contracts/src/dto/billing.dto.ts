export interface CreateClaimRequest {
  patientId: string;
  providerId: string;
  insurerId: string;
  type: 'professional' | 'institutional' | 'pharmacy' | 'oral';
  use: 'claim' | 'preauthorization' | 'predetermination';
  items: Array<{
    serviceDate: string;
    code: string;
    codeSystem?: string;
    display: string;
    quantity: number;
    unitPrice: number;
    netAmount: number;
  }>;
  notes?: string;
}

export interface SubmitClaimRequest {
  claimId: string;
  submittedBy: string;
}

export interface AdjudicateClaimRequest {
  claimId: string;
  outcome: 'adjudicated' | 'partial' | 'denied';
  adjudicatorNotes?: string;
  lineItems: Array<{
    serviceCode: string;
    amountApproved: number;
    amountDenied: number;
    denialReason?: string;
  }>;
}

export interface PostPaymentRequest {
  claimId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes?: string;
}

export interface ClaimResponse {
  id: string;
  fhirId?: string;
  patientId: string;
  providerId: string;
  insurerId: string;
  status: 'draft' | 'submitted' | 'pending' | 'adjudicated' | 'partial' | 'denied' | 'paid';
  type: string;
  use: string;
  totalAmount: number;
  amountApproved?: number;
  amountPaid?: number;
  items: Array<{
    serviceCode: string;
    quantity: number;
    unitPrice: number;
    netAmount: number;
    amountApproved?: number;
    denialReason?: string;
  }>;
  submittedAt?: string;
  adjudicatedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSummaryResponse {
  totalClaims: number;
  totalBilled: number;
  totalApproved: number;
  totalPaid: number;
  totalDenied: number;
  denialRate: number;
}
