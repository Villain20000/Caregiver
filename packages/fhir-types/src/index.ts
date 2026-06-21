/**
 * packages/fhir-types/src/index.ts
 *
 * Public API for the @caregiver/fhir-types package.
 *
 * Re-exports all FHIR R4 type definitions so consumers can import everything
 * from a single entry point:
 *   import { Patient, Encounter, Observation } from '@caregiver/fhir-types';
 */

// ── FHIR specification metadata ──────────────────────────────
export { FHIR_VERSION } from './fhir-version.js';

// ── Base types (shared by all resources) ─────────────────────
export type * from './base.js';
export {
  type Resource,
  type DomainResource,
  type Bundle,
  type BundleEntry,
  type Reference,
  type CodeableConcept,
  type Coding,
  type Identifier,
  type HumanName,
  type ContactPoint,
  type Address,
  type Period,
  type Quantity,
  type Ratio,
  type Attachment,
  type Meta,
  type Extension,
} from './base.js';

// ── Resource type enum + registry ────────────────────────────
export { RESOURCE_TYPES, type ResourceType } from './resource-types.js';

// ── Individual resource interfaces ───────────────────────────
export type * from './resources/patient.js';
export type * from './resources/practitioner.js';
export type * from './resources/encounter.js';
export type * from './resources/appointment.js';
export type * from './resources/observation.js';
export type * from './resources/diagnostic-report.js';
export type * from './resources/medication-request.js';
export type * from './resources/medication-dispense.js';
export type * from './resources/service-request.js';
export type * from './resources/claim.js';
export type * from './resources/explanation-of-benefit.js';
export type * from './resources/audit-event.js';

// ── Convenience re-exports of resource types ─────────────────
export type { Patient } from './resources/patient.js';
export type { Practitioner } from './resources/practitioner.js';
export type { Encounter } from './resources/encounter.js';
export type { Appointment } from './resources/appointment.js';
export type { Observation } from './resources/observation.js';
export type { DiagnosticReport } from './resources/diagnostic-report.js';
export type { MedicationRequest } from './resources/medication-request.js';
export type { MedicationDispense } from './resources/medication-dispense.js';
export type { ServiceRequest } from './resources/service-request.js';
export type { Claim } from './resources/claim.js';
export type { ExplanationOfBenefit } from './resources/explanation-of-benefit.js';
export type { AuditEvent } from './resources/audit-event.js';
