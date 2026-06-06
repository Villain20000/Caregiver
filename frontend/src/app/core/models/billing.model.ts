export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
export type ClaimStatus = 'queued' | 'submitted' | 'accepted' | 'denied' | 'paid' | 'appealed';
export type TimesheetStatus = 'open' | 'submitted' | 'approved' | 'rejected' | 'exported';

export interface LineItem {
  code: string;        // CPT / HCPCS
  description: string;
  units: number;
  rate: number;        // USD
}

export interface Invoice {
  id: string;
  number: string;      // INV-2025-0001
  patientId: string;
  payer: string;       // 'Medicare A', 'BCBS', 'Aetna', 'Self-pay'
  issuedAt: string;
  dueAt: string;
  status: InvoiceStatus;
  items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface Claim {
  id: string;
  invoiceId: string;
  cpt: string;
  submittedAt?: string;
  status: ClaimStatus;
  payer: string;
  amount: number;
  denialReason?: string;
  appealDeadline?: string;
}

export interface Timesheet {
  id: string;
  userId: string;
  shiftId: string;
  clockIn: string;
  clockOut?: string;
  hours: number;
  status: TimesheetStatus;
  notes?: string;
  approverId?: string;
}
