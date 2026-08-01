/**
 * packages/fhir-types/src/resources/organization.ts
 *
 * FHIR R4 `Organization` resource — a formal grouping of people or
 * organizations with a common purpose (hospital, clinic, insurance company).
 *
 * Used by: Admin, Billing Specialist roles (for provider/insurer records).
 *
 * @see https://hl7.org/fhir/R4/organization.html
 */
import type {
  DomainResource,
  Identifier,
  HumanName,
  ContactPoint,
  Address,
  Reference,
  CodeableConcept,
} from '../base.js';

/** FHIR R4 Organization resource. */
export interface Organization extends DomainResource {
  resourceType: 'Organization';
  identifier?: Identifier[];
  active?: boolean;
  type?: CodeableConcept[];
  name?: string;
  alias?: string[];
  telecom?: ContactPoint[];
  address?: Address[];
  partOf?: Reference;
  contact?: Array<{
    purpose?: CodeableConcept;
    name?: HumanName;
    telecom?: ContactPoint[];
    address?: Address;
  }>;
}
