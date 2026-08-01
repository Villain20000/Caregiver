/**
 * packages/fhir-types/src/resources/location.ts
 *
 * FHIR R4 `Location` resource — physical location or mobile unit where
 * healthcare services are provided (hospital ward, clinic room, ambulance).
 *
 * Used by: All roles (for encounter location tracking).
 *
 * @see https://hl7.org/fhir/R4/location.html
 */
import type {
  DomainResource,
  Identifier,
  Address,
  CodeableConcept,
  Reference,
  ContactPoint,
} from '../base.js';

/** FHIR R4 Location resource. */
export interface Location extends DomainResource {
  resourceType: 'Location';
  identifier?: Identifier[];
  status?: 'active' | 'suspended' | 'inactive';
  name?: string;
  description?: string;
  mode?: 'instance' | 'kind';
  type?: CodeableConcept[];
  telecom?: ContactPoint[];
  address?: Address;
  physicalType?: CodeableConcept;
  managingOrganization?: Reference;
  partOf?: Reference;
}
