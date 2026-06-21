/**
 * packages/fhir-types/src/resources/observation.ts
 *
 * FHIR R4 `Observation` resource — measurements and simple assertions made
 * about a patient, device, or other subject. Used for vitals (heart rate,
 * blood pressure, temperature), lab results, and clinical observations.
 *
 * Used by: Nurse, Doctor, Patient, Lab Tech roles.
 *
 * @see https://hl7.org/fhir/R4/observation.html
 */
import type { DomainResource, Identifier, Reference, CodeableConcept, Period, Quantity, FhirBoolean, FhirString, FhirDateTime, FhirInstant } from '../base.js';

/** Observation status — FHIR R4 value set. */
export type ObservationStatus =
  | 'registered'
  | 'preliminary'
  | 'final'
  | 'amended'
  | 'corrected'
  | 'cancelled'
  | 'entered-in-error'
  | 'unknown';

/** Reference range for an observation (normal range, critical range, etc.). */
export interface ObservationReferenceRange {
  /** Low end of the range. */
  low?: Quantity;
  /** High end of the range. */
  high?: Quantity;
  /** Type of range (normal, therapeutic, critical, etc.). */
  type?: CodeableConcept;
  /** Whether the range applies (age, gender, etc.). */
  appliesTo?: CodeableConcept[];
  /** Age range this applies to. */
  age?: { low?: Quantity; high?: Quantity };
  /** Text representation of the range. */
  text?: FhirString;
}

/** FHIR R4 Observation resource. */
export interface Observation extends DomainResource {
  resourceType: 'Observation';
  /** Business identifiers (accession number, etc.). */
  identifier?: Identifier[];
  /** Based-on references (service requests, care plans, etc.). */
  basedOn?: Reference[];
  /** Part-of references (encounter, procedure, etc.). */
  partOf?: Reference[];
  /** Current state of the observation. */
  status: ObservationStatus;
  /** Classification of observation type (vital-signs, laboratory, imaging, etc.). */
  category?: CodeableConcept[];
  /** Type of observation (LOINC code, e.g. '8867-4' for heart rate). */
  code: CodeableConcept;
  /** The subject of the observation (usually a Patient). */
  subject?: Reference;
  /** Who/what the observation is about (alternative to subject). */
  focus?: Reference[];
  /** Encounter during which the observation was made. */
  encounter?: Reference;
  /** Time of the observation (clinically relevant time). */
  effectiveDateTime?: FhirDateTime;
  effectivePeriod?: Period;
  effectiveTiming?: { event?: FhirDateTime[] };
  effectiveInstant?: FhirInstant;
  /** When the observation was recorded in the system. */
  issued?: FhirInstant;
  /** Who performed the observation. */
  performer?: Reference[];
  /** Value of the observation (quantity, codeable concept, string, etc.). */
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: FhirString;
  valueBoolean?: FhirBoolean;
  valueInteger?: number;
  /** Why the value is missing (if applicable). */
  dataAbsentReason?: CodeableConcept;
  /** Interpretation of the result (normal, high, low, critical, etc.). */
  interpretation?: CodeableConcept[];
  /** Comments about the observation. */
  note?: Array<{ authorReference?: Reference; authorString?: FhirString; time?: FhirDateTime; text: FhirString }>;
  /** Body site where the observation was made. */
  bodySite?: CodeableConcept;
  /** Method used for the observation. */
  method?: CodeableConcept;
  /** Specimen used for the observation (for lab tests). */
  specimen?: Reference[];
  /** Device used for the observation. */
  device?: Reference;
  /** Reference ranges (normal values for this observation type). */
  referenceRange?: ObservationReferenceRange[];
  /** Whether the observation has components (multi-part observations). */
  hasMember?: Reference[];
  /** Derived from other observations. */
  derivedFrom?: Reference[];
  /** Component results (for multi-part observations like blood pressure). */
  component?: Array<{
    code: CodeableConcept;
    valueQuantity?: Quantity;
    valueCodeableConcept?: CodeableConcept;
    valueString?: FhirString;
    valueBoolean?: FhirBoolean;
    valueInteger?: number;
    dataAbsentReason?: CodeableConcept;
    interpretation?: CodeableConcept[];
    referenceRange?: ObservationReferenceRange[];
  }>;
}
