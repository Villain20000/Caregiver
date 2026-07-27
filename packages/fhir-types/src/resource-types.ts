/**
 * packages/fhir-types/src/resource-types.ts
 *
 * Registry of all FHIR R4 resource types supported by the Caregiver platform.
 * This is a curated subset — not the full FHIR spec (which has 150+ resources).
 *
 * The `RESOURCE_TYPES` const array is the canonical source; `ResourceType`
 * is a union type derived from it. Adding a resource here automatically
 * makes it available to all consumers.
 */

/**
 * All FHIR R4 resource types supported by the platform.
 * Each string must match the `resourceType` discriminator field in the
 * corresponding FHIR JSON resource.
 */
export const RESOURCE_TYPES = [
  'Patient',
  'Practitioner',
  'Encounter',
  'Appointment',
  'Observation',
  'DiagnosticReport',
  'MedicationRequest',
  'MedicationDispense',
  'ServiceRequest',
  'Claim',
  'ExplanationOfBenefit',
  'AuditEvent',
  'Organization',
  'Location',
  'Condition',
  'Medication',
] as const;

/** Union type of all supported FHIR resource type strings. */
export type ResourceType = (typeof RESOURCE_TYPES)[number];
