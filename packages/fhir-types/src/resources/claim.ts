/**
 * packages/fhir-types/src/resources/claim.ts
 *
 * FHIR R4 `Claim` resource — a request for adjudication and reimbursement
 * of healthcare services. Created by the billing specialist after a patient
 * encounter.
 *
 * Used by: Billing Specialist role.
 *
 * @see https://hl7.org/fhir/R4/claim.html
 */
import type { DomainResource, Identifier, Reference, CodeableConcept, Period, Quantity, FhirBoolean, FhirString, FhirDateTime, FhirPositiveInt } from '../base.js';

/** Claim status — FHIR R4 value set. */
export type ClaimStatus = 'active' | 'cancelled' | 'draft' | 'entered-in-error';

/** Type of claim (institutional, professional, pharmacy, etc.). */
export type ClaimType = 'institutional' | 'oral' | 'pharmacy' | 'professional' | 'vision';

/** Claim item — a billed line item. */
export interface ClaimItem {
  /** Sequence number (line item ID). */
  sequence: FhirPositiveInt;
  /** Whether this item is cared for (vs. being billed). */
  careTeamSequence?: FhirPositiveInt[];
  /** Diagnosis sequence references. */
  diagnosisSequence?: FhirPositiveInt[];
  /** Procedure sequence references. */
  procedureSequence?: FhirPositiveInt[];
  /** Information sequence references. */
  informationSequence?: FhirPositiveInt[];
  /** Revenue code. */
  revenue?: CodeableConcept;
  /** Category of the product/service. */
  category?: CodeableConcept;
  /** Billing code for the product/service. */
  productOrService?: CodeableConcept;
  /** Modifiers to the billing code. */
  modifier?: CodeableConcept[];
  /** Program under which the service is billed. */
  programCode?: CodeableConcept[];
  /** Date the service was provided. */
  servicedDate?: FhirDateTime;
  servicedPeriod?: Period;
  /** Location where the service was provided. */
  locationCodeableConcept?: CodeableConcept;
  locationAddress?: { line?: FhirString[]; city?: FhirString; state?: FhirString; postalCode?: FhirString };
  /** Quantity of the product/service. */
  quantity?: Quantity;
  /** Unit price of the product/service. */
  unitPrice?: { value?: number; currency?: FhirString };
  /** Factor (multiplier) for the unit price. */
  factor?: number;
  /** Total cost of the item. */
  net?: { value?: number; currency?: FhirString };
  /** Whether the patient paid for this item. */
  udi?: Reference[];
  /** Body site. */
  bodySite?: CodeableConcept;
  /** Sub-site. */
  subSite?: CodeableConcept[];
  /** Encounter references. */
  encounter?: Reference[];
  /** Detail sub-items. */
  detail?: Array<{
    sequence: FhirPositiveInt;
    revenue?: CodeableConcept;
    category?: CodeableConcept;
    productOrService?: CodeableConcept;
    modifier?: CodeableConcept[];
    quantity?: Quantity;
    unitPrice?: { value?: number; currency?: FhirString };
    factor?: number;
    net?: { value?: number; currency?: FhirString };
    udi?: Reference[];
    subDetail?: Array<{
      sequence: FhirPositiveInt;
      productOrService?: CodeableConcept;
      quantity?: Quantity;
      net?: { value?: number; currency?: FhirString };
    }>;
  }>;
}

/** FHIR R4 Claim resource. */
export interface Claim extends DomainResource {
  resourceType: 'Claim';
  /** Business identifiers (claim number, etc.). */
  identifier?: Identifier[];
  /** Current status of the claim. */
  status: ClaimStatus;
  /** Type of claim (institutional, professional, etc.). */
  type: CodeableConcept;
  /** Subtype of claim. */
  subType?: CodeableConcept;
  /** Whether this is a pre-determination or pre-authorization. */
  use: 'claim' | 'preauthorization' | 'predetermination';
  /** The patient for whom the claim is made. */
  patient: Reference;
  /** The billing period. */
  billablePeriod?: Period;
  /** When the claim was created. */
  created: FhirDateTime;
  /** Who created the claim. */
  enterer?: Reference;
  /** The insurer. */
  insurer?: Reference;
  /** The provider (billing party). */
  provider: Reference;
  /** Priority of the claim. */
  priority: CodeableConcept;
  /** Funds requested to be reserved. */
  fundsReserve?: CodeableConcept;
  /** Related claims. */
  related?: Array<{ claim?: Reference; relationship?: CodeableConcept; reference?: Identifier }>;
  /** Prescription being claimed. */
  prescription?: Reference;
  /** Original prescription (for refills). */
  originalPrescription?: Reference;
  /** The payee (who receives the payment). */
  payee?: { type?: CodeableConcept; party?: Reference };
  /** Referral information. */
  referral?: Reference;
  /** Facility where services were provided. */
  facility?: Reference;
  /** Care team members. */
  careTeam?: Array<{
    sequence: FhirPositiveInt;
    provider: Reference;
    responsible?: FhirBoolean;
    role?: CodeableConcept;
    qualification?: CodeableConcept;
  }>;
  /** Supporting information. */
  supportingInfo?: Array<{
    sequence: FhirPositiveInt;
    category: CodeableConcept;
    code?: CodeableConcept;
    timingDate?: FhirDateTime;
    timingPeriod?: Period;
    valueBoolean?: FhirBoolean;
    valueString?: FhirString;
    valueQuantity?: Quantity;
    valueAttachment?: { contentType?: FhirString; url?: FhirString };
    reason?: CodeableConcept;
  }>;
  /** Diagnoses. */
  diagnosis?: Array<{
    sequence: FhirPositiveInt;
    diagnosisCodeableConcept?: CodeableConcept;
    diagnosisReference?: Reference;
    type?: CodeableConcept[];
    onAdmission?: CodeableConcept;
    packageCode?: CodeableConcept;
  }>;
  /** Procedures. */
  procedure?: Array<{
    sequence: FhirPositiveInt;
    type?: CodeableConcept[];
    date?: FhirDateTime;
    procedureCodeableConcept?: CodeableConcept;
    procedureReference?: Reference;
    udi?: Reference[];
  }>;
  /** Insurance coverage. */
  insurance?: Array<{
    sequence: FhirPositiveInt;
    focal: FhirBoolean;
    coverage: Reference;
    businessArrangement?: FhirString;
    preAuthRef?: FhirString[];
    claimResponse?: Reference;
  }>;
  /** Accident information. */
  accident?: { date?: FhirDateTime; type?: CodeableConcept; locationAddress?: object; locationReference?: Reference };
  /** Billed items. */
  item: ClaimItem[];
  /** Total claim amount. */
  total: { value?: number; currency?: FhirString };
}
