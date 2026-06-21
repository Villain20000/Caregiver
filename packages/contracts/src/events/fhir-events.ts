/**
 * packages/contracts/src/events/fhir-events.ts
 *
 * Event payload types for FHIR resource lifecycle events.
 *
 * Topics:
 *   - fhir.resource.ingested  → emitted by API gateway when a bundle arrives
 *   - fhir.resource.validated → emitted by fhir-ingestion after R4 validation
 */

/** Payload for `fhir.resource.ingested` — raw FHIR bundle received by the gateway. */
export interface FhirResourceIngestedPayload {
  /** The raw FHIR Bundle JSON (as received from the external system). */
  bundle: unknown;
  /** The source system that sent the bundle (for audit). */
  sourceSystem: string;
  /** The user who submitted the bundle (for audit). */
  submittedBy?: string;
}

/** Payload for `fhir.resource.validated` — validated FHIR resource ready for persistence. */
export interface FhirResourceValidatedPayload {
  /** The FHIR resource type (Patient, Observation, etc.). */
  resourceType: string;
  /** The FHIR logical ID. */
  fhirId: string;
  /** The validated FHIR resource JSON. */
  resource: unknown;
  /** Whether validation passed. */
  valid: boolean;
  /** Validation errors (if any). */
  errors?: string[];
  /** The database row ID (if persisted). */
  dbId?: string;
}
