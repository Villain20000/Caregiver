/**
 * packages/contracts/src/events/ai-events.ts
 *
 * Event payload types for the AI diagnosis pipeline.
 *
 * Topics:
 *   - ai.diagnosis.requested → emitted by API gateway on behalf of a doctor
 *   - ai.diagnosis.completed  → emitted by ai-rag after LLM + RAG processing
 */

/** Payload for `ai.diagnosis.requested` — a doctor requested an AI-assisted diagnosis. */
export interface AiDiagnosisRequestedPayload {
  /** The database UUID of the diagnosis request. */
  diagnosisId: string;
  /** The patient the diagnosis is for. */
  patientId: string;
  /** The practitioner who requested the diagnosis. */
  requestedBy: string;
  /** The role of the requesting practitioner. */
  requestedByRole: string;
  /** The clinical context/question for the LLM. */
  inputContext: string;
  /** Optional: specific FHIR resources to include in RAG context. */
  fhirResourceIds?: string[];
  /** When the request was made (ISO 8601). */
  requestedAt: string;
}

/** Payload for `ai.diagnosis.completed` — the AI returned a diagnosis. */
export interface AiDiagnosisCompletedPayload {
  /** The database UUID of the diagnosis request. */
  diagnosisId: string;
  /** The patient the diagnosis is for. */
  patientId: string;
  /** The practitioner who requested the diagnosis. */
  requestedBy: string;
  /** The LLM's diagnosis output. */
  diagnosis: string;
  /** Source references from RAG retrieval (ChromaDB document IDs). */
  sourceReferences: Array<{
    /** Document ID in ChromaDB. */
    documentId: string;
    /** Similarity score (0-1). */
    score: number;
    /** Human-readable source description. */
    description: string;
  }>;
  /** The model that produced the diagnosis (e.g. 'llama3:8b'). */
  model: string;
  /** Processing time in milliseconds. */
  processingTimeMs: number;
  /** Whether the diagnosis completed successfully. */
  success: boolean;
  /** Error message (if failed). */
  errorMessage?: string;
  /** When the diagnosis completed (ISO 8601). */
  completedAt: string;
}
