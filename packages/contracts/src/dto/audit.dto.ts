export interface AuditSearchRequest {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditExportRequest {
  format: 'csv' | 'pdf';
  userId?: string;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditRedactRequest {
  auditLogIds: string[];
  fields: string[];
  reason: string;
  requestedBy: string;
}

export interface AuditBreachReportRequest {
  detectedAt: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedUsers: string[];
  affectedResourceTypes: string[];
  reportedBy: string;
  notes?: string;
}

export interface AuditResponse {
  id: string;
  userId: string | null;
  userRole: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  result: string;
  errorMessage: string | null;
  sourceIp: string | null;
  serviceName: string;
  details: Record<string, unknown> | null;
  occurredAt: string;
}

export interface AuditExportResponse {
  url: string;
  format: string;
  generatedAt: string;
  recordCount: number;
}

export interface AuditBreachReportResponse {
  id: string;
  reportNumber: string;
  status: string;
  createdAt: string;
}
