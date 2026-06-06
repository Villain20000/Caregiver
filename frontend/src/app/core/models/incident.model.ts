export type IncidentSeverity = 'low' | 'med' | 'high' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'mitigated' | 'closed';
export type IncidentKind =
  | 'fall'
  | 'med-error'
  | 'elopement'
  | 'skin-event'
  | 'behavioral'
  | 'equipment'
  | 'communication'
  | 'other';

export interface Incident {
  id: string;
  patientId: string;
  kind: IncidentKind;
  severity: IncidentSeverity;
  status: IncidentStatus;
  occurredAt: string;
  reportedBy: string;
  reportedAt: string;
  summary: string;
  witnesses: string[];
  correctiveActions: string[];
  rootCause?: string;
  attachments?: { id: string; name: string; size: number }[];
  closedAt?: string;
  closedBy?: string;
}
