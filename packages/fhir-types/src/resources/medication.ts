/**
 * packages/fhir-types/src/resources/medication.ts
 *
 * FHIR R4 `Medication` resource — a medication or pharmaceutical product.
 * Used as the definitional resource referenced by MedicationRequest and
 * MedicationDispense.
 *
 * Used by: Pharmacist, Doctor roles (for medication catalog).
 *
 * @see https://hl7.org/fhir/R4/medication.html
 */
import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Ratio,
  Reference,
  FhirDateTime,
} from '../base.js';

/** FHIR R4 Medication resource. */
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
