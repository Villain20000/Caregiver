/**
 * packages/fhir-types/src/resources/audit-event.ts
 *
 * FHIR R4 `AuditEvent` resource — a record of an event relevant to the
 * audit of a healthcare system. Used by the audit microservice for HIPAA
 * compliance and regulatory reporting.
 *
 * Used by: Auditor, Medical Director roles.
 *
 * @see https://hl7.org/fhir/R4/auditevent.html
 */
import type { DomainResource, Reference, CodeableConcept, FhirString, FhirInstant } from '../base.js';

/** Audit event action — what happened. */
export type AuditEventAction = 'C' | 'R' | 'U' | 'D' | 'E';

/** Audit event outcome. */
export type AuditEventOutcome = '0' | '4' | '8' | '12';

/** Who was involved in the audit event. */
export interface AuditEventAgent {
  /** Type of agent (user, practitioner, device, etc.). */
  type?: CodeableConcept;
  /** Role of the agent. */
  role?: CodeableConcept[];
  /** Whether this agent is the requestor. */
  who?: Reference;
  /** Alternative agent identifier. */
  altId?: FhirString;
  /** Agent name. */
  name?: FhirString;
  /** Whether this agent is the requestor. */
  requestor: boolean;
  /** Agent location. */
  location?: Reference;
  /** Network information. */
  network?: {
    address?: FhirString;
    type?: '1' | '2' | '3' | '4' | '5';
  };
  /** Purpose of use. */
  purposeOfUse?: CodeableConcept[];
}

/** What entity was involved in the audit event. */
export interface AuditEventEntity {
  /** What entity. */
  what?: Reference;
  /** Entity type. */
  type?: CodeableConcept;
  /** Entity role. */
  role?: CodeableConcept;
  /** Lifecycle. */
  lifecycle?: CodeableConcept;
  /** Security classification. */
  securityLabel?: CodeableConcept[];
  /** Entity name. */
  name?: FhirString;
  /** Entity description. */
  description?: FhirString;
  /** Query parameters. */
  query?: FhirString;
  /** Detail. */
  detail?: Array<{
    type: FhirString;
    valueBase64Binary?: FhirString;
    valueString?: FhirString;
    valueReference?: Reference;
  }>;
}

/** FHIR R4 AuditEvent resource. */
export interface AuditEvent extends DomainResource {
  resourceType: 'AuditEvent';
  /** Type of audit event (REST, login, etc.). */
  type: CodeableConcept;
  /** Subtype of audit event. */
  subtype?: CodeableConcept[];
  /** Action that occurred (C=create, R=read, U=update, D=delete, E=execute). */
  action?: AuditEventAction;
  /** When the event occurred. */
  recorded: FhirInstant;
  /** Outcome of the event (0=success, 4=minor failure, 8=serious failure, 12=major failure). */
  outcome: AuditEventOutcome;
  /** Description of the outcome. */
  outcomeDesc?: FhirString;
  /** Purpose of the event. */
  purposeOfUse?: CodeableConcept[];
  /** Agents involved in the event. */
  agent: AuditEventAgent[];
  /** Source of the event. */
  source: {
    site?: FhirString;
    observer: Reference;
    type?: CodeableConcept[];
  };
  /** Entities involved in the event. */
  entity?: AuditEventEntity[];
}
