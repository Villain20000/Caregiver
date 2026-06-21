/**
 * packages/fhir-types/src/resources/practitioner.ts
 *
 * FHIR R4 `Practitioner` resource — a person who is directly or indirectly
 * involved in the provisioning of healthcare (doctor, nurse, pharmacist, etc.).
 *
 * Used by: Doctor, Nurse, Radiologist, Pharmacist, Lab Tech roles.
 *
 * @see https://hl7.org/fhir/R4/practitioner.html
 */
import type { DomainResource, Identifier, HumanName, ContactPoint, Address, CodeableConcept, Reference, FhirBoolean, FhirDate, FhirCode, FhirString } from '../base.js';

/** FHIR R4 Practitioner resource. */
export interface Practitioner extends DomainResource {
  resourceType: 'Practitioner';
  /** Business identifiers (NPI, license number, DEA number, etc.). */
  identifier?: Identifier[];
  /** Whether this practitioner record is active. */
  active?: FhirBoolean;
  /** Practitioner's names. */
  name?: HumanName[];
  /** Contact details (phone, email, etc.). */
  telecom?: ContactPoint[];
  /** Addresses (office, clinic, etc.). */
  address?: Address[];
  /** Administrative gender. */
  gender?: 'male' | 'female' | 'other' | 'unknown';
  /** Date of birth. */
  birthDate?: FhirDate;
  /** Photos of the practitioner. */
  photo?: Array<{ contentType?: FhirCode; url?: FhirString; data?: FhirString }>;
  /** Qualifications (degrees, certifications, licenses). */
  qualification?: Array<{
    /** The qualification code (e.g. MD, RN, PharmD). */
    code: CodeableConcept;
    /** Period during which the qualification is valid. */
    period?: { start?: FhirString; end?: FhirString };
    /** Organization that issued the qualification. */
    issuer?: Reference;
  }>;
  /** Languages the practitioner can communicate in. */
  communication?: CodeableConcept[];
}
