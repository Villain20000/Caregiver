/**
 * apps/web/src/app/services/audit.service.ts
 *
 * Angular service for querying audit trail events.
 *
 * Wraps the /api/audit endpoints for listing logs, filtering by user,
 * and filtering by FHIR resource type and id.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { AuditResponse } from '@caregiver/contracts';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);

  /**
   * List recent audit log entries.
   *
   * @param limit - Optional maximum number of entries to return.
   * @param offset - Optional pagination offset.
   * @returns Observable emitting the list of audit log entries.
   */
  listAuditLogs(limit?: number, offset?: number) {
    const params: Record<string, string> = {};
    if (limit !== undefined) params.limit = String(limit);
    if (offset !== undefined) params.offset = String(offset);
    return this.http.get<AuditResponse[]>('/api/audit', { params });
  }

  /**
   * Fetch audit log entries for a specific user.
   *
   * @param userId - Id of the user whose activity should be returned.
   * @param limit - Optional maximum number of entries to return.
   * @returns Observable emitting the matching audit log entries.
   */
  getByUser(userId: string, limit?: number) {
    const params: Record<string, string> = {};
    if (limit !== undefined) params.limit = String(limit);
    return this.http.get<AuditResponse[]>(`/api/audit/user/${userId}`, { params });
  }

  /**
   * Fetch audit log entries related to a specific resource.
   *
   * @param resourceType - FHIR resource type (e.g. "Patient").
   * @param resourceId - Id of the resource.
   * @param limit - Optional maximum number of entries to return.
   * @returns Observable emitting the matching audit log entries.
   */
  getByResource(resourceType: string, resourceId: string, limit?: number) {
    const params: Record<string, string> = {};
    if (limit !== undefined) params.limit = String(limit);
    return this.http.get<AuditResponse[]>(`/api/audit/resource/${resourceType}/${resourceId}`, { params });
  }
}
