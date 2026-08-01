/**
 * packages/contracts/src/dto/audit.dto.ts
 *
 * REST DTOs for audit trail querying, exporting, and breach reporting.
 *
 * 📝 Learning Note: These DTOs support the Auditor and Medical Director
 * roles, who need filtered access to the immutable audit log.
 */

/** Search audit logs request — query parameters for GET /api/audit. */
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
