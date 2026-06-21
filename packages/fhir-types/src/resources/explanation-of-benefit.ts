/**
 * packages/fhir-types/src/resources/explanation-of-benefit.ts
 *
 * FHIR R4 `ExplanationOfBenefit` (EOB) resource — the insurer's response to
 * a Claim, detailing what was paid, denied, and the patient's responsibility.
 *
 * Used by: Billing Specialist role.
 *
 * @see https://hl7.org/fhir/R4/explanationofbenefit.html
 */
import type { DomainResource, Identifier, Reference, CodeableConcept, Period, Quantity, FhirBoolean, FhirString, FhirDateTime, FhirPositiveInt } from '../base.js';

/** EOB status — FHIR R4 value set. */
export type EobStatus = 'active' | 'cancelled' | 'draft' | 'entered-in-error';

/** EOB outcome. */
export type EobOutcome = 'complete' | 'error' | 'partial';

/** Adjudication result for an item. */
export interface EobItemAdjudication {
  /** Category of adjudication (submitted, eligible, copay, etc.). */
  category: CodeableConcept;
  /** Reason for the adjudication. */
  reason?: CodeableConcept;
  /** Amount adjudicated. */
  amount?: { value?: number; currency?: FhirString };
  /** Value adjudicated (percentage, etc.). */
  value?: number;
}

/** FHIR R4 ExplanationOfBenefit resource. */
export interface ExplanationOfBenefit extends DomainResource {
  resourceType: 'ExplanationOfBenefit';
  /** Business identifiers (EOB number, etc.). */
  identifier?: Identifier[];
  /** Current status of the EOB. */
  status: EobStatus;
  /** Type of claim this EOB is for. */
  type: CodeableConcept;
  /** Subtype. */
  subType?: CodeableConcept;
  /** Whether this is a claim, pre-auth, or pre-determination response. */
  use: 'claim' | 'preauthorization' | 'predetermination';
  /** The patient. */
  patient: Reference;
  /** The billing period. */
  billablePeriod?: Period;
  /** When the EOB was created. */
  created: FhirDateTime;
  /** Who entered the EOB. */
  enterer?: Reference;
  /** The insurer. */
  insurer: Reference;
  /** The provider. */
  provider: Reference;
  /** The payee. */
  payee?: { type?: CodeableConcept; party?: Reference };
  /** Referral. */
  referral?: Reference;
  /** Facility. */
  facility?: Reference;
  /** The claim this EOB is for. */
  claim?: Reference;
  /** The claim response. */
  claimResponse?: Reference;
  /** Outcome of the adjudication. */
  outcome: EobOutcome;
  /** Human-readable description of the outcome. */
  disposition?: FhirString;
  /** Pre-auth reference numbers. */
  preAuthRef?: FhirString[];
  /** Pre-auth period. */
  preAuthRefPeriod?: Period;
  /** Care team. */
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
  }>;
  /** Diagnoses. */
  diagnosis?: Array<{
    sequence: FhirPositiveInt;
    diagnosisCodeableConcept?: CodeableConcept;
    diagnosisReference?: Reference;
    type?: CodeableConcept[];
    onAdmission?: CodeableConcept;
  }>;
  /** Procedures. */
  procedure?: Array<{
    sequence: FhirPositiveInt;
    type?: CodeableConcept[];
    date?: FhirDateTime;
    procedureCodeableConcept?: CodeableConcept;
    procedureReference?: Reference;
  }>;
  /** Insurance coverage. */
  insurance?: Array<{
    sequence: FhirPositiveInt;
    focal: FhirBoolean;
    coverage: Reference;
    preAuthRef?: FhirString[];
  }>;
  /** Accident. */
  accident?: { date?: FhirDateTime; type?: CodeableConcept };
  /** Billed items with adjudication. */
  item?: Array<{
    sequence: FhirPositiveInt;
    careTeamSequence?: FhirPositiveInt[];
    diagnosisSequence?: FhirPositiveInt[];
    procedureSequence?: FhirPositiveInt[];
    informationSequence?: FhirPositiveInt[];
    revenue?: CodeableConcept;
    category?: CodeableConcept;
    productOrService?: CodeableConcept;
    modifier?: CodeableConcept[];
    servicedDate?: FhirDateTime;
    servicedPeriod?: Period;
    locationCodeableConcept?: CodeableConcept;
    quantity?: Quantity;
    unitPrice?: { value?: number; currency?: FhirString };
    factor?: number;
    net?: { value?: number; currency?: FhirString };
    udi?: Reference[];
    bodySite?: CodeableConcept;
    subSite?: CodeableConcept[];
    encounter?: Reference[];
    noteNumber?: FhirPositiveInt[];
    adjudication?: EobItemAdjudication[];
    detail?: Array<{
      sequence: FhirPositiveInt;
      productOrService?: CodeableConcept;
      quantity?: Quantity;
      net?: { value?: number; currency?: FhirString };
      adjudication?: EobItemAdjudication[];
      subDetail?: Array<{
        sequence: FhirPositiveInt;
        productOrService?: CodeableConcept;
        quantity?: Quantity;
        net?: { value?: number; currency?: FhirString };
        adjudication?: EobItemAdjudication[];
      }>;
    }>;
  }>;
  /** Add items (items added by the insurer). */
  addItem?: Array<{
    itemSequence?: FhirPositiveInt;
    detailSequence?: FhirPositiveInt;
    subDetailSequence?: FhirPositiveInt;
    provider?: Reference[];
    productOrService?: CodeableConcept;
    modifier?: CodeableConcept[];
    servicedDate?: FhirDateTime;
    servicedPeriod?: Period;
    quantity?: Quantity;
    net?: { value?: number; currency?: FhirString };
    adjudication?: EobItemAdjudication[];
  }>;
  /** Adjudication totals. */
  total?: Array<{
    category: CodeableConcept;
    amount: { value?: number; currency?: FhirString };
  }>;
  /** Payment information. */
  payment?: {
    type?: CodeableConcept;
    adjustment?: { value?: number; currency?: FhirString };
    adjustmentReason?: CodeableConcept;
    date?: FhirDateTime;
    amount?: { value?: number; currency?: FhirString };
    identifier?: Identifier;
  };
  /** Form code. */
    formCode?: CodeableConcept;
  /** Form (attachment). */
  form?: { contentType?: FhirString; url?: FhirString };
  /** Process notes. */
  processNote?: Array<{
    number?: FhirPositiveInt;
    type?: 'display' | 'print' | 'printoper';
    text?: FhirString;
    language?: CodeableConcept;
  }>;
  /** Benefit balances. */
  benefitBalance?: Array<{
    category: CodeableConcept;
    excluded?: FhirBoolean;
    name?: FhirString;
    description?: FhirString;
    network?: CodeableConcept;
    unit?: CodeableConcept;
    term?: CodeableConcept;
    financial?: Array<{
      type: CodeableConcept;
      allowedUnsignedInt?: number;
      allowedString?: FhirString;
      allowedMoney?: { value?: number; currency?: FhirString };
      usedUnsignedInt?: number;
      usedMoney?: { value?: number; currency?: FhirString };
    }>;
  }>;
}
