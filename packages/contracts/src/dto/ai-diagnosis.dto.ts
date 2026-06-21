/**
 * packages/contracts/src/dto/ai-diagnosis.dto.ts
 *
 * REST DTOs for AI-assisted diagnosis endpoints.
 * Used by the NestJS API gateway for request validation.
 */

/** Request AI diagnosis request body — POST /api/ai/diagnose. */
export interface RequestDiagnosisRequest {
  /** The patient's user ID. */
  patientId: string;
  /** The clinical context/question for the LLM. */
  inputContext: string;
  /** Optional: specific FHIR resource IDs to include in RAG context. */
  fhirResourceIds?: string[];
}

/** AI diagnosis response body — returned by GET /api/ai/diagnoses/:id. */
export interface AiDiagnosisResponse {
  /** Diagnosis request UUID. */
  id: string;
  /** Patient's user ID. */
  patientId: string;
  /** Who requested the diagnosis. */
  requestedBy: string;
  /** Current status (requested, processing, completed, approved, overridden). */
  status: 'requested' | 'processing' | 'completed' | 'approved' | 'overridden' | 'failed';
  /** The LLM's diagnosis output (available when status is 'completed'). */
  diagnosis?: string;
  /** Source references from RAG retrieval. */
  sourceReferences?: Array<{
    documentId: string;
    score: number;
    description: string;
  }>;
  /** The model that produced the diagnosis. */
  model?: string;
  /** Who reviewed the diagnosis (if approved/overridden). */
  reviewedBy?: string;
  /** Reviewer's notes. */
  reviewNotes?: string;
  /** When the request was made (ISO 8601). */
  createdAt: string;
  /** When the diagnosis completed (ISO 8601). */
  completedAt?: string;
  /** When the diagnosis was reviewed (ISO 8601). */
  reviewedAt?: string;
}

/** Review diagnosis request body — POST /api/ai/diagnoses/:id/review. */
export interface ReviewDiagnosisRequest {
  /** Whether to approve or override the diagnosis. */
  decision: 'approve' | 'override';
  /** Reviewer's notes. */
  reviewNotes?: string;
  /** Override diagnosis (required if decision is 'override'). */
  overrideDiagnosis?: string;
}
