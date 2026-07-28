import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Ratio,
  Reference,
  FhirDateTime,
} from '../base.js';

export interface Medication extends DomainResource {
  resourceType: 'Medication';
  identifier?: Identifier[];
  code?: CodeableConcept;
  status?: 'active' | 'inactive' | 'entered-in-error';
  manufacturer?: Reference;
  form?: CodeableConcept;
  amount?: Ratio;
  ingredient?: Array<{
    itemCodeableConcept?: CodeableConcept;
    itemReference?: Reference;
    isActive?: boolean;
    strength?: Ratio;
  }>;
  batch?: {
    lotNumber?: string;
    expirationDate?: FhirDateTime;
  };
}
