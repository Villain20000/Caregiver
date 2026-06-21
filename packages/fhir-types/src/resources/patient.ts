/**
 * packages/fhir-types/src/resources/patient.ts
 *
 * FHIR R4 `Patient` resource — demographics and administrative data about
 * an individual receiving health-related services.
 *
 * Used by: ALL roles (every clinical interaction involves a patient).
 *
 * @see https://hl7.org/fhir/R4/patient.html
 */
import type { DomainResource, Identifier, HumanName, ContactPoint, Address, CodeableConcept, Reference, Period, FhirBoolean, FhirDate, FhirCode, FhirString } from '../base.js';

/** Administrative gender — FHIR R4 value set. */
export type AdministrativeGender = 'male' | 'female' | 'other' | 'unknown';

/** A contact for the patient (emergency contact, guardian, etc.). */
export interface PatientContact {
  /** Relationship to the patient (emergency, family, guardian). */
  relationship?: CodeableConcept[];
  /** The contact person's name. */
  name?: HumanName;
  /** Contact details (phone, email). */
  telecom?: ContactPoint[];
  /** Address of the contact. */
  address?: Address;
  /** Administrative gender of the contact. */
  gender?: AdministrativeGender;
  /** Organization that acts as the contact (if not a person). */
  organization?: Reference;
  /** Period during which this contact was valid. */
  period?: Period;
}

/** FHIR R4 Patient resource. */
export interface Patient extends DomainResource {
  resourceType: 'Patient';
  /** Business identifiers (MRN, SSN, driver's license, etc.). */
  identifier?: Identifier[];
  /** Whether this patient record is active. */
  active?: FhirBoolean;
  /** Patient's names (can have multiple: legal, maiden, nickname). */
  name?: HumanName[];
  /** Contact details (phone, email, etc.). */
  telecom?: ContactPoint[];
  /** Administrative gender (male, female, other, unknown). */
  gender?: AdministrativeGender;
  /** Date of birth (YYYY-MM-DD; partial dates allowed). */
  birthDate?: FhirDate;
  /** Whether the patient is deceased. If boolean, yes/no; if dateTime, when. */
  deceasedBoolean?: FhirBoolean;
  deceasedDateTime?: FhirString;
  /** Addresses (home, work, etc.). */
  address?: Address[];
  /** Marital status (single, married, divorced, etc.). */
  maritalStatus?: CodeableConcept;
  /** Whether the patient has multiple births (and how many). */
  multipleBirthBoolean?: FhirBoolean;
  multipleBirthInteger?: number;
  /** Photo of the patient. */
  photo?: Array<{ contentType?: FhirCode; url?: FhirString; data?: FhirString }>;
  /** Contacts for the patient (emergency contacts, guardians). */
  contact?: PatientContact[];
  /** Languages the patient communicates in. */
  communication?: Array<{
    language: CodeableConcept;
    preferred?: FhirBoolean;
  }>;
  /** Organization that is the custodian of the patient record. */
  managingOrganization?: Reference;
  /** Other patients this patient is linked to (duplicates, etc.). */
  link?: Array<{
    other: Reference;
    type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
  }>;
}
