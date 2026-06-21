/**
 * packages/fhir-types/src/resources/service-request.ts
 *
 * FHIR R4 `ServiceRequest` resource — a record of a request for a service
 * such as a diagnostic investigation, surgical procedure, or nursing care.
 * Used for lab orders and imaging orders.
 *
 * Used by: Doctor (order), Lab Tech (fulfill), Radiologist (fulfill) roles.
 *
 * @see https://hl7.org/fhir/R4/servicerequest.html
 */
import type { DomainResource, Identifier, Reference, CodeableConcept, Period, Quantity, FhirBoolean, FhirString, FhirDateTime } from '../base.js';

/** Service request status — FHIR R4 value set. */
export type ServiceRequestStatus =
  | 'draft'
  | 'active'
  | 'on-hold'
  | 'revoked'
  | 'completed'
  | 'entered-in-error'
  | 'unknown';

/** Intent of the request. */
export type ServiceRequestIntent =
  | 'proposal'
  | 'plan'
  | 'order'
  | 'original-order'
  | 'reflex-order'
  | 'filler-order'
  | 'instance-order'
  | 'option';

/** FHIR R4 ServiceRequest resource. */
export interface ServiceRequest extends DomainResource {
  resourceType: 'ServiceRequest';
  /** Business identifiers (accession number, placer number, etc.). */
  identifier?: Identifier[];
  /** Based-on references (care plan, etc.). */
  basedOn?: Reference[];
  /** Replaces references (superseded requests). */
  replaces?: Reference[];
  /** Requisition (group identifier for batch orders). */
  requisition?: Identifier;
  /** Current status of the request. */
  status: ServiceRequestStatus;
  /** Intent of the request (order, plan, proposal). */
  intent: ServiceRequestIntent;
  /** Category of the request (lab, imaging, etc.). */
  category?: CodeableConcept[];
  /** Priority of the request (routine, urgent, stat). */
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  /** Whether this is a "do not perform" request. */
  doNotPerform?: FhirBoolean;
  /** What is being requested (coded or referenced). */
  code?: CodeableConcept;
  /** Order detail (additional coded details). */
  orderDetail?: CodeableConcept[];
  /** Quantity of the service requested. */
  quantityQuantity?: Quantity;
  quantityRatio?: { numerator?: Quantity; denominator?: Quantity };
  quantityRange?: { low?: Quantity; high?: Quantity };
  /** The subject of the request (usually a Patient). */
  subject: Reference;
  /** Encounter during which the request was made. */
  encounter?: Reference;
  /** When the service should occur. */
  occurrenceDateTime?: FhirDateTime;
  occurrencePeriod?: Period;
  occurrenceTiming?: { repeat?: { frequency?: number; period?: number; periodUnit?: FhirString } };
  /** When the request was authored. */
  authoredOn?: FhirDateTime;
  /** Who made the request. */
  requester?: Reference;
  /** Type of performer requested (e.g. 'lab technician'). */
  performerType?: CodeableConcept;
  /** Who should perform the service. */
  performer?: Reference[];
  /** Location where the service should occur. */
  locationCode?: CodeableConcept[];
  locationReference?: Reference[];
  /** Reason for the request (coded). */
  reasonCode?: CodeableConcept[];
  /** Reason for the request (condition references). */
  reasonReference?: Reference[];
  /** Insurance coverage for the request. */
  insurance?: Reference[];
  /** Supporting information. */
  supportingInfo?: Reference[];
  /** Specimen to be used (for lab tests). */
  specimen?: Reference[];
  /** Body site where the service should be performed. */
  bodySite?: CodeableConcept[];
  /** Comments about the request. */
  note?: Array<{ authorReference?: Reference; authorString?: FhirString; time?: FhirDateTime; text: FhirString }>;
  /** Patient instructions. */
  patientInstruction?: FhirString;
  /** Relevant history. */
  relevantHistory?: Reference[];
}
