export type RxStatus = 'active' | 'expired' | 'renewed' | 'cancelled';

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  drug: string;
  dose: string;
  frequency: string;
  duration: string;          // free text, e.g. "30 days"
  refills: number;
  notes?: string;
  status: RxStatus;
  issuedAt: number;          // epoch ms
  expiresAt: number;         // epoch ms
  signedBy?: string;
  signatureDataUrl?: string; // base64 PNG of the signing pad
}

export interface RxPatient {
  id: string;
  name: string;
}
