import type { DomainResource, Identifier, Address, CodeableConcept, Reference, ContactPoint } from '../base.js';

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
