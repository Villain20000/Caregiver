export type MedRisk = 'low' | 'moderate' | 'high' | 'controlled';

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dose: string;        // e.g. "10 mg"
  route: 'PO' | 'IV' | 'IM' | 'SC' | 'Topical' | 'INH';
  schedule: string;    // e.g. "08:00, 20:00"
  times: string[];     // ISO datetimes for upcoming doses
  riskLevel: MedRisk;
  prescribedBy: string; // userId
  lastGiven?: string;   // ISO
  lastGivenBy?: string; // userId
  doubleVerify: boolean;
  notes?: string;
  category: 'analgesic' | 'antibiotic' | 'cardiac' | 'endocrine' | 'psych' | 'supplement' | 'other';
  refillsRemaining: number;
}

export interface MedAdministration {
  id: string;
  medicationId: string;
  patientId: string;
  givenAt: string;       // ISO
  givenBy: string;       // userId
  verifiedBy?: string;   // userId, required if doubleVerify
  skipped?: boolean;
  reason?: string;
}
