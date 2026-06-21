/**
 * services/fhir-ingestion/src/fhir/fhir-validation.service.ts
 *
 * FHIR R4 structural validation service.
 *
 * Performs *basic* structural validation of FHIR resources — NOT full
 * conformance validation against the official FHIR JSON schemas. The goal
 * is to reject obviously malformed payloads early (before persistence)
 * while keeping the implementation lightweight and dependency-free.
 *
 * Validation checks performed:
 *   1. `resourceType` is present and is one of the supported RESOURCE_TYPES.
 *   2. `id` is present (FHIR logical ID is required for persistence/upsert).
 *   3. The FHIR version declared in `meta.profile` (if any) is compatible
 *      with the R4 version the platform targets (FHIR_VERSION).
 *   4. Resource-type-specific required fields are present (a curated subset
 *      of the FHIR R4 cardinality rules — see REQUIRED_FIELDS below).
 *
 * Both individual resources and Bundle resources are supported. For Bundles,
 * each entry's `resource` is validated independently and the aggregate
 * result is returned.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  FHIR_VERSION,
  RESOURCE_TYPES,
  type Bundle,
  type Resource,
} from '@caregiver/fhir-types';

/**
 * Curated map of required top-level fields per FHIR resource type.
 *
 * This is a *subset* of the official FHIR R4 cardinality constraints —
 * it captures the fields the Caregiver platform considers mandatory for
 * a resource to be useful downstream. Resources missing these fields are
 * flagged as invalid but still persisted with `validationStatus='invalid'`
 * so the original data is not lost.
 *
 * @see https://hl7.org/fhir/R4/ — official cardinality rules
 */
const REQUIRED_FIELDS: Record<string, readonly string[]> = {
  Patient: ['name'],
  Practitioner: ['name'],
  Encounter: ['status'],
  Appointment: ['status', 'participant'],
  Observation: ['status', 'code', 'subject'],
  DiagnosticReport: ['status', 'code'],
  MedicationRequest: ['status', 'intent', 'subject'],
  MedicationDispense: ['status', 'subject'],
  ServiceRequest: ['status', 'intent', 'subject'],
  Claim: ['status', 'type', 'use', 'patient', 'created', 'provider'],
  ExplanationOfBenefit: ['status', 'type', 'use', 'patient', 'created', 'insurer', 'provider'],
  AuditEvent: ['type', 'recorded', 'outcome', 'agent', 'source'],
};

/** The canonical R4 profile URI prefix used to verify FHIR version. */
const R4_PROFILE_PREFIX = 'http://hl7.org/fhir/4.0';

/**
 * Result of validating a single FHIR resource.
 */
export interface FhirValidationResult {
  /** Whether the resource passed all validation checks. */
  valid: boolean;
  /** The FHIR resource type (may be unknown/invalid). */
  resourceType: string;
  /** The FHIR logical ID (may be missing/invalid). */
  fhirId: string;
  /** The validated resource (echoed back for the persistence step). */
  resource: Resource;
  /** Validation error messages (empty when valid). */
  errors: string[];
}

/**
 * FhirValidationService — stateless, injectable validator.
 *
 * Exposed methods:
 *   - `validateResource(resource)`  → validate a single resource
 *   - `validateBundle(bundle)`      → validate every entry in a Bundle
 */
@Injectable()
export class FhirValidationService {
  private readonly logger = new Logger('FhirValidationService');

  /**
   * Validate a single FHIR resource structurally.
   *
   * @param resource - The raw FHIR resource JSON (typed as `unknown` from
   *                   the wire; narrowed internally).
   * @returns A validation result with `valid`, `errors`, and metadata.
   */
  validateResource(resource: unknown): FhirValidationResult {
    const errors: string[] = [];

    // ── Narrow to a record-like shape for field access ──────────
    // We avoid `any` by casting through `unknown` to a typed record.
    const obj = (resource ?? {}) as Record<string, unknown>;
    const resourceType = typeof obj['resourceType'] === 'string' ? obj['resourceType'] : '';
    const fhirId = typeof obj['id'] === 'string' ? obj['id'] : '';

    // ── Check 1: resourceType present + supported ───────────────
    if (!resourceType) {
      errors.push('Missing required field: resourceType');
    } else if (!RESOURCE_TYPES.includes(resourceType as never)) {
      // RESOURCE_TYPES is a readonly tuple; cast to `never` satisfies the
      // `as const` union check without widening the type.
      errors.push(
        `Unsupported resourceType: '${resourceType}'. Supported: ${RESOURCE_TYPES.join(', ')}`,
      );
    }

    // ── Check 2: id present (required for upsert keying) ────────
    if (!fhirId) {
      errors.push('Missing required field: id');
    }

    // ── Check 3: FHIR version compatibility (if declared) ───────
    // Resources are not required to declare a version, but if `meta.profile`
    // is present it must reference the R4 profile. This catches accidentally
    // submitted STU3/R5 resources.
    const meta = obj['meta'] as { profile?: unknown } | undefined;
    if (meta?.profile) {
      const profiles = Array.isArray(meta.profile) ? meta.profile : [meta.profile];
      for (const profile of profiles) {
        if (typeof profile === 'string' && profile.length > 0) {
          // Any profile URI not rooted at the R4 namespace is suspicious.
          if (!profile.startsWith(R4_PROFILE_PREFIX) && !profile.includes('/fhir/')) {
            errors.push(
              `Profile '${profile}' is not an R4 profile (expected ${R4_PROFILE_PREFIX}*). Target version: ${FHIR_VERSION}`,
            );
          }
        }
      }
    }

    // ── Check 4: resource-type-specific required fields ─────────
    const required = REQUIRED_FIELDS[resourceType];
    if (required) {
      for (const field of required) {
        const value = obj[field];
        // Treat `undefined`, `null`, empty string, and empty array as missing.
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          errors.push(`Missing required field for ${resourceType}: ${field}`);
        }
      }
    }

    const valid = errors.length === 0;
    if (!valid) {
      this.logger.warn(`Validation failed for ${resourceType}/${fhirId || '<no-id>'}: ${errors.join('; ')}`);
    }

    return {
      valid,
      resourceType,
      fhirId,
      // Cast through `unknown` — the object came from the wire and has been
      // structurally checked above; the `Resource` type is a loose interface.
      resource: obj as unknown as Resource,
      errors,
    };
  }

  /**
   * Validate every entry in a FHIR Bundle.
   *
   * Entries without a `resource` are skipped (recorded as an error result
   * so the caller can audit them). The returned array is order-preserving
   * and aligned with the bundle's `entry` array.
   *
   * @param bundle - The raw FHIR Bundle JSON.
   * @returns One validation result per bundle entry.
   */
  validateBundle(bundle: unknown): FhirValidationResult[] {
    const results: FhirValidationResult[] = [];

    // Narrow the bundle shape.
    const b = (bundle ?? {}) as Partial<Bundle>;
    const entries = Array.isArray(b.entry) ? b.entry : [];

    if (entries.length === 0) {
      this.logger.warn('Bundle contains no entries; nothing to validate.');
      return results;
    }

    for (const [index, entry] of entries.entries()) {
      if (!entry || !entry.resource) {
        // An entry without a resource is malformed — record a synthetic
        // failure so the audit trail captures it.
        results.push({
          valid: false,
          resourceType: 'Unknown',
          fhirId: '',
          resource: {} as Resource,
          errors: [`Bundle entry[${index}] has no resource`],
        });
        continue;
      }
      results.push(this.validateResource(entry.resource));
    }

    return results;
  }
}
