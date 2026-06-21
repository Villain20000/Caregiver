/**
 * packages/fhir-types/src/resources/encounter.ts
 *
 * FHIR R4 `Encounter` resource — an interaction between a patient and
 * healthcare provider(s) for the purpose of providing services or assessing
 * health status.
 *
 * Used by: Doctor, Nurse, Patient roles.
 *
 * @see https://hl7.org/fhir/R4/encounter.html
 */
import type { DomainResource, Identifier, Reference, CodeableConcept, Period, FhirString } from '../base.js';

/** Encounter status — FHIR R4 value set. */
export type EncounterStatus =
  | 'planned'
  | 'arrived'
  | 'triaged'
  | 'in-progress'
  | 'onleave'
  | 'finished'
  | 'cancelled'
  | 'entered-in-error'
  | 'unknown';

/** FHIR R4 Encounter resource. */
export interface Encounter extends DomainResource {
  resourceType: 'Encounter';
  /** Business identifiers (visit number, encounter number, etc.). */
  identifier?: Identifier[];
  /** Current state of the encounter. */
  status: EncounterStatus;
  /** History of encounter statuses (status timeline). */
  statusHistory?: Array<{
    status: EncounterStatus;
    period: Period;
  }>;
  /** Classification of the encounter (ambulatory, emergency, inpatient, etc.). */
  class?: {
    system?: FhirString;
    code?: FhirString;
    display?: FhirString;
    version?: FhirString;
  };
  /** More specific classification (e.g. 'wellness', 'acute'). */
  type?: CodeableConcept[];
  /** Service type (e.g. 'cardiology', 'emergency'). */
  serviceType?: CodeableConcept;
  /** Priority of the encounter (urgent, routine, etc.). */
  priority?: CodeableConcept;
  /** The patient present at the encounter. */
  subject?: Reference;
  /** The episode(s) of care that this encounter is part of. */
  episodeOfCare?: Reference[];
  /** Other participants in the encounter (doctors, nurses, etc.). */
  participant?: Array<{
    type?: CodeableConcept[];
    period?: Period;
    individual?: Reference;
  }>;
  /** Appointment that scheduled this encounter. */
  appointment?: Reference[];
  /** Time the encounter started and ended. */
  period?: Period;
  /** Length of the encounter (duration). */
  length?: { value?: number; unit?: FhirString; system?: FhirString; code?: FhirString };
  /** Reason for the encounter (chief complaint, etc.). */
  reasonCode?: CodeableConcept[];
  /** Reason for the encounter (condition references). */
  reasonReference?: Reference[];
  /** Diagnoses relevant to this encounter. */
  diagnosis?: Array<{
    condition: Reference;
    use?: CodeableConcept;
    rank?: number;
  }>;
  /** The party responsible for billing. */
  account?: Reference[];
  /** Where the encounter occurred (hospital, ward, room, bed). */
  location?: Array<{
    location: Reference;
    status?: 'planned' | 'active' | 'reserved' | 'completed';
    physicalType?: CodeableConcept;
    period?: Period;
  }>;
  /** Organization responsible for the encounter. */
  serviceProvider?: Reference;
  /** Whether this is part of a multi-part encounter. */
  partOf?: Reference;
}
