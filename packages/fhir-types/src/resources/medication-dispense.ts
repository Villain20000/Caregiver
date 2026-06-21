/**
 * packages/fhir-types/src/resources/medication-dispense.ts
 *
 * FHIR R4 `MedicationDispense` resource — indicates that a medication
 * product has been dispensed for a named patient. Created by the pharmacist
 * when filling a MedicationRequest.
 *
 * Used by: Pharmacist (dispense), Doctor (verify) roles.
 *
 * @see https://hl7.org/fhir/R4/medicationdispense.html
 */
import type { DomainResource, Identifier, Reference, CodeableConcept, Quantity, FhirBoolean, FhirString, FhirDateTime } from '../base.js';

/** Medication dispense status — FHIR R4 value set. */
export type MedicationDispenseStatus =
  | 'preparation'
  | 'in-progress'
  | 'cancelled'
  | 'on-hold'
  | 'completed'
  | 'entered-in-error'
  | 'stopped'
  | 'declined'
  | 'unknown';

/** FHIR R4 MedicationDispense resource. */
export interface MedicationDispense extends DomainResource {
  resourceType: 'MedicationDispense';
  /** Business identifiers (dispense number, etc.). */
  identifier?: Identifier[];
  /** Based-on references (the MedicationRequest being filled). */
  basedOn?: Reference[];
  /** Part-of references (event, procedure, etc.). */
  partOf?: Reference[];
  /** Current status of the dispense. */
  status: MedicationDispenseStatus;
  /** Why the dispense was not performed (if applicable). */
  statusReasonCode?: CodeableConcept[];
  statusReasonReference?: Reference[];
  /** Category of the dispense (inpatient, outpatient, etc.). */
  category?: CodeableConcept;
  /** The medication that was dispensed (coded or referenced). */
  medicationCodeableConcept?: CodeableConcept;
  medicationReference?: Reference;
  /** The subject of the dispense (usually a Patient). */
  subject?: Reference;
  /** Encounter during which the dispense occurred. */
  context?: Reference;
  /** Other supporting information. */
  supportingInformation?: Reference[];
  /** Who performed the dispense. */
  performer?: Array<{
    function?: CodeableConcept;
    actor: Reference;
  }>;
  /** Location where the dispense occurred. */
  location?: Reference;
  /** Who the medication is for (if not the subject). */
  destination?: Reference;
  /** Whether the patient was given the medication directly. */
  receiver?: Reference[];
  /** Whether substitutions were made. */
  substitution?: {
    wasSubstituted: FhirBoolean;
    type?: CodeableConcept;
    reason?: CodeableConcept[];
    responsibleParty?: Reference[];
  };
  /** Previous dispense (for refills). */
  priorDispense?: Reference;
  /** Detected issues (drug interactions, allergies, etc.). */
  detectedIssue?: Reference[];
  /** Event history. */
  eventHistory?: Reference[];
  /** What was dispensed (quantity, days supply, etc.). */
  quantity?: Quantity;
  /** Days supply. */
  daysSupply?: Quantity;
  /** When the dispense was prepared. */
  whenPrepared?: FhirDateTime;
  /** When the dispense was handed to the patient. */
  whenHandedOver?: FhirDateTime;
  /** Destination of the dispense. */
  destinationNote?: FhirString;
  /** Dosage instructions. */
  dosageInstruction?: Array<{
    sequence?: number;
    text?: FhirString;
    timing?: { repeat?: { frequency?: number; period?: number; periodUnit?: FhirString } };
    route?: CodeableConcept;
    doseAndRate?: Array<{ doseQuantity?: Quantity; rateQuantity?: Quantity }>;
  }>;
}
