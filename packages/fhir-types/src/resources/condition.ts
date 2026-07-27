import type { DomainResource, Identifier, CodeableConcept, Reference, Period, Annotation, FhirDateTime, FhirCode } from '../base.js';

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
