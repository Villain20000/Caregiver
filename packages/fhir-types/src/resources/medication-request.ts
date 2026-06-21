/**
 * packages/fhir-types/src/resources/medication-request.ts
 *
 * FHIR R4 `MedicationRequest` resource — an order for the supply of a
 * medication and the instructions for its administration to a patient.
 *
 * Used by: Doctor (prescribe), Pharmacist (review/fill) roles.
 *
 * @see https://hl7.org/fhir/R4/medicationrequest.html
 */
import type { DomainResource, Identifier, Reference, CodeableConcept, Period, Quantity, FhirBoolean, FhirString, FhirDateTime } from '../base.js';

/** Medication request status — FHIR R4 value set. */
export type MedicationRequestStatus =
  | 'active'
  | 'on-hold'
  | 'cancelled'
  | 'completed'
  | 'entered-in-error'
  | 'stopped'
  | 'draft'
  | 'unknown';

/** Intent of the request — distinguishes orders from plans from proposals. */
export type MedicationRequestIntent =
  | 'proposal'
  | 'plan'
  | 'order'
  | 'original-order'
  | 'reflex-order'
  | 'filler-order'
  | 'instance-order'
  | 'option';

/** Dosage instructions for a medication. */
export interface Dosage {
  /** Sequence of the dosage instruction (for multi-step regimens). */
  sequence?: number;
  /** Free text dosage instructions. */
  text?: FhirString;
  /** Timing of the dose (frequency, period, etc.). */
  timing?: {
    repeat?: {
      frequency?: number;
      period?: number;
      periodUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
      boundsPeriod?: Period;
      dayOfWeek?: FhirString[];
      timeOfDay?: FhirString[];
      when?: FhirString[];
    };
    code?: CodeableConcept;
  };
  /** Whether to take as needed. */
  asNeededBoolean?: FhirBoolean;
  asNeededCodeableConcept?: CodeableConcept;
  /** Body site of administration. */
  site?: CodeableConcept;
  /** Route of administration (oral, IV, etc.). */
  route?: CodeableConcept;
  /** Method of administration. */
  method?: CodeableConcept;
  /** Dose quantity. */
  doseAndRate?: Array<{
    type?: CodeableConcept;
    doseQuantity?: Quantity;
    doseRatio?: { numerator?: Quantity; denominator?: Quantity };
    rateQuantity?: Quantity;
  }>;
  /** Max dose per period. */
  maxDosePerPeriod?: { numerator?: Quantity; denominator?: Quantity };
  /** Max dose per administration. */
  maxDosePerAdministration?: Quantity;
}

/** FHIR R4 MedicationRequest resource. */
export interface MedicationRequest extends DomainResource {
  resourceType: 'MedicationRequest';
  /** Business identifiers (prescription number, etc.). */
  identifier?: Identifier[];
  /** Based-on references (care plan, etc.). */
  basedOn?: Reference[];
  /** Prior prescription reference (for refills). */
  priorPrescription?: Reference;
  /** Group identifier (for prescriptions filled together). */
  groupIdentifier?: Identifier;
  /** Current status of the request. */
  status: MedicationRequestStatus;
  /** Intent of the request (order, plan, proposal). */
  intent: MedicationRequestIntent;
  /** Category of the medication request (inpatient, outpatient, etc.). */
  category?: CodeableConcept[];
  /** Priority of the request (routine, urgent, stat). */
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  /** Whether this is a "do not fill" request. */
  doNotPerform?: FhirBoolean;
  /** The medication being prescribed (coded or referenced). */
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  /** The subject of the medication order (usually a Patient). */
  subject: Reference;
  /** Encounter during which the request was made. */
  encounter?: Reference;
  /** Other supporting information. */
  supportingInformation?: Reference[];
  /** When the request was authored. */
  authoredOn?: FhirDateTime;
  /** Who made the request (practitioner). */
  requester?: Reference;
  /** Who will administer the medication. */
  performer?: Reference;
  /** Type of performer (pharmacist, nurse, etc.). */
  performerType?: CodeableConcept;
  /** Recording device (if entered by a device). */
  recorder?: Reference;
  /** Reason for the prescription (coded). */
  reasonCode?: CodeableConcept[];
  /** Reason for the prescription (condition references). */
  reasonReference?: Reference[];
  /** Whether substitutions are allowed. */
  substitution?: {
    allowedBoolean?: FhirBoolean;
    allowedCodeableConcept?: CodeableConcept;
    reason?: CodeableConcept;
  };
  /** Previous dispense request (for refills). */
  priorDispenseRequest?: Reference;
  /** Dispense request details (quantity, days supply, etc.). */
  dispenseRequest?: {
    initialFill?: { quantity?: Quantity; duration?: Period };
    dispenseInterval?: Period;
    validityPeriod?: Period;
    numberOfRepeatsAllowed?: number;
    quantity?: Quantity;
    expectedSupplyDuration?: Period;
    performer?: Reference;
  };
  /** Whether the prescription can be dispensed in multiple events. */
  detectedIssue?: Reference[];
  /** Event history (audit trail). */
  eventHistory?: Reference[];
  /** Dosage instructions. */
  dosageInstruction?: Dosage[];
}
