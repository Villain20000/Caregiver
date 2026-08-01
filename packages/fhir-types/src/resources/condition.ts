/**
 * packages/fhir-types/src/resources/condition.ts
 *
 * FHIR R4 `Condition` resource — a clinical condition, problem, diagnosis,
 * or other event that has occurred or is ongoing (e.g. diabetes, hypertension).
 *
 * Used by: Doctor, Nurse roles (for diagnosis/problem list tracking).
 *
 * @see https://hl7.org/fhir/R4/condition.html
 */
import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Reference,
  Period,
  Annotation,
  FhirDateTime,
} from '../base.js';

/** FHIR R4 Condition resource. */
export interface Condition extends DomainResource {
  resourceType: 'Condition';
  identifier?: Identifier[];
  clinicalStatus?: CodeableConcept;
  verificationStatus?: CodeableConcept;
  category?: CodeableConcept[];
  severity?: CodeableConcept;
  code?: CodeableConcept;
  bodySite?: CodeableConcept[];
  subject: Reference;
  encounter?: Reference;
  onsetDateTime?: FhirDateTime;
  onsetPeriod?: Period;
  abatementDateTime?: FhirDateTime;
  abatementPeriod?: Period;
  recordedDate?: FhirDateTime;
  recorder?: Reference;
  asserter?: Reference;
  stage?: Array<{
    summary?: CodeableConcept;
    assessment?: Reference[];
    type?: CodeableConcept;
  }>;
  note?: Annotation[];
}
