/**
 * apps/web/src/app/services/fhir.service.ts
 *
 * Angular service for interacting with the FHIR ingestion and search API.
 *
 * Provides methods to search persisted FHIR resources, retrieve a single
 * resource, and submit raw FHIR bundles for validation and ingestion.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/** Shape of a persisted FHIR resource returned by the backend. */
export interface FhirResourceResponse {
  /** Internal database id of the stored resource. */
  id: string;
  /** FHIR resource type (e.g. Patient, Observation). */
  resourceType: string;
  /** FHIR logical id of the resource. */
  fhirId: string;
  /** Raw FHIR R4 resource payload. */
  resource: unknown;
  /** Validation status of the stored resource. */
  validationStatus: string;
  /** Timestamp when the resource was created. */
  createdAt: string;
  /** Timestamp when the resource was last updated. */
  updatedAt: string;
}

/** Summary returned after ingesting a FHIR bundle. */
export interface IngestSummary {
  /** Whether the bundle was accepted by the API. */
  valid: boolean;
  /** Total number of resources contained in the bundle. */
  totalResources: number;
  /** Number of resources that passed validation. */
  validResources: number;
  /** Number of resources that failed validation. */
  invalidResources: number;
}

@Injectable({ providedIn: 'root' })
export class FhirService {
  private readonly http = inject(HttpClient);

  /**
   * Search persisted FHIR resources.
   *
   * @param resourceType - Optional FHIR resource type filter (e.g. "Patient").
   * @param search - Optional free-text search string (matched against FHIR id).
   * @param limit - Optional pagination limit.
   * @param offset - Optional pagination offset.
   * @returns Observable emitting the matching list of resources.
   */
  searchResources(resourceType?: string, search?: string, limit?: number, offset?: number) {
    const params: Record<string, string> = {};
    if (resourceType) params.resourceType = resourceType;
    if (search) params.search = search;
    if (limit !== undefined) params.limit = String(limit);
    if (offset !== undefined) params.offset = String(offset);
    return this.http.get<FhirResourceResponse[]>('/api/fhir/resources', { params });
  }

  /**
   * Retrieve a single persisted FHIR resource.
   *
   * @param resourceType - FHIR resource type (e.g. "Observation").
   * @param id - FHIR logical id of the resource.
   * @returns Observable emitting the resource.
   */
  getResource(resourceType: string, id: string) {
    return this.http.get<FhirResourceResponse>(`/api/fhir/${resourceType}/${id}`);
  }

  /**
   * Submit a raw FHIR bundle for validation and ingestion.
   *
   * @param bundle - Parsed FHIR bundle payload.
   * @param sourceSystem - Identifier for the originating system.
   * @param submittedBy - Optional id of the user submitting the bundle.
   * @returns Observable emitting the ingestion summary.
   */
  ingestBundle(bundle: unknown, sourceSystem: string, submittedBy?: string) {
    return this.http.post<IngestSummary>('/api/fhir/ingest', { bundle, sourceSystem, submittedBy });
  }
}
