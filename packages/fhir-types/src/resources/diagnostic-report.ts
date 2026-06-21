/**
 * packages/fhir-types/src/resources/diagnostic-report.ts
 *
 * FHIR R4 `DiagnosticReport` resource — the findings and interpretation of
 * diagnostic tests performed on patients. Used for lab reports, radiology
 * reports, pathology reports, etc.
 *
 * Used by: Radiologist, Lab Tech, Doctor roles.
 *
 * @see https://hl7.org/fhir/R4/diagnosticreport.html
 */
import type { DomainResource, Identifier, Reference, CodeableConcept, Period, Attachment, FhirString, FhirDateTime, FhirInstant } from '../base.js';

/** Diagnostic report status — FHIR R4 value set. */
export type DiagnosticReportStatus =
  | 'registered'
  | 'partial'
  | 'preliminary'
  | 'final'
  | 'amended'
  | 'corrected'
  | 'appended'
  | 'cancelled'
  | 'entered-in-error'
  | 'unknown';

/** FHIR R4 DiagnosticReport resource. */
export interface DiagnosticReport extends DomainResource {
  resourceType: 'DiagnosticReport';
  /** Business identifiers (accession number, report ID, etc.). */
  identifier?: Identifier[];
  /** Based-on references (service requests, etc.). */
  basedOn?: Reference[];
  /** Current status of the report. */
  status: DiagnosticReportStatus;
  /** Category of report (lab, radiology, pathology, etc.). */
  category?: CodeableConcept[];
  /** Type of report (LOINC code, e.g. '19005-8' for CBC). */
  code: CodeableConcept;
  /** The subject of the report (usually a Patient). */
  subject?: Reference;
  /** Encounter during which the report was generated. */
  encounter?: Reference;
  /** Time of the observation (specimen collection or test execution). */
  effectiveDateTime?: FhirDateTime;
  effectivePeriod?: Period;
  /** When the report was issued. */
  issued?: FhirInstant;
  /** Who is responsible for the report. */
  performer?: Reference[];
  /** Results (observations that make up the report). */
  result?: Reference[];
  /** Imaging study references (for radiology reports). */
  imagingStudy?: Reference[];
  /** Media references (images, etc.). */
  media?: Array<{
    comment?: FhirString;
    link: Reference;
  }>;
  /** Clinical conclusion/interpretation of the report. */
  conclusion?: FhirString;
  /** Coded conclusion codes. */
  conclusionCode?: CodeableConcept[];
  /** Full report narrative (formatted text). */
  presentedForm?: Attachment[];
}
