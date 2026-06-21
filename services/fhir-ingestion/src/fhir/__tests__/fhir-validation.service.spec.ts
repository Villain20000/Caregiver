/**
 * services/fhir-ingestion/src/fhir/__tests__/fhir-validation.service.spec.ts
 *
 * Unit tests for FhirValidationService — basic structural validation of
 * FHIR R4 resources and Bundles.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  type Patient,
  type Observation,
  type Bundle,
  type BundleEntry,
  type CodeableConcept,
  type Reference,
} from '@caregiver/fhir-types';
import { FhirValidationService } from '../fhir-validation.service.js';

describe('FhirValidationService', () => {
  let service: FhirValidationService;

  beforeEach(() => {
    service = new FhirValidationService();
  });

  // ── Helpers to build well-formed FHIR resources ──────────────
  const validPatient = (): Patient => ({
    resourceType: 'Patient',
    id: 'patient-1',
    name: [
      {
        family: 'Doe',
        given: ['John'],
      },
    ],
  });

  const validObservation = (): Observation => ({
    resourceType: 'Observation',
    id: 'obs-1',
    status: 'final',
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate',
        },
      ],
    } as CodeableConcept,
    subject: { reference: 'Patient/patient-1' } as Reference,
  });

  // ── validateResource — happy path ────────────────────────────
  describe('validateResource', () => {
    it('returns valid:true for a well-formed Patient resource', () => {
      const result = service.validateResource(validPatient());
      expect(result.valid).toBe(true);
      expect(result.resourceType).toBe('Patient');
      expect(result.fhirId).toBe('patient-1');
      expect(result.errors).toEqual([]);
    });

    it('returns valid:true for a well-formed Observation (status, code, subject)', () => {
      const result = service.validateResource(validObservation());
      expect(result.valid).toBe(true);
      expect(result.resourceType).toBe('Observation');
      expect(result.fhirId).toBe('obs-1');
      expect(result.errors).toEqual([]);
    });

    // ── validateResource — error cases ─────────────────────────
    it('returns valid:false with an error when resourceType is missing', () => {
      const { resourceType, ...noType } = validPatient();
      void resourceType;
      const result = service.validateResource(noType);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: resourceType');
    });

    it('returns valid:false when resourceType is not in RESOURCE_TYPES', () => {
      const result = service.validateResource({
        ...validPatient(),
        resourceType: 'NotARealResource',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.startsWith('Unsupported resourceType:'))).toBe(true);
    });

    it('returns valid:false when id is missing', () => {
      const { id, ...noId } = validPatient();
      void id;
      const result = service.validateResource(noId);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: id');
    });

    it('returns valid:false when an Observation is missing required fields', () => {
      // Missing status, code, and subject.
      const result = service.validateResource({
        resourceType: 'Observation',
        id: 'obs-bad',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field for Observation: status');
      expect(result.errors).toContain('Missing required field for Observation: code');
      expect(result.errors).toContain('Missing required field for Observation: subject');
    });
  });

  // ── validateBundle ───────────────────────────────────────────
  describe('validateBundle', () => {
    it('returns one result per entry for a valid Bundle with 2 entries', () => {
      const entries: BundleEntry[] = [
        { resource: validPatient() },
        { resource: validObservation() },
      ];
      const bundle: Bundle = {
        resourceType: 'Bundle',
        id: 'bundle-1',
        type: 'batch',
        entry: entries,
      };

      const results = service.validateBundle(bundle);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.valid)).toBe(true);
    });

    it('returns 2 results with mixed valid flags when 1 entry is valid and 1 is invalid', () => {
      const entries: BundleEntry[] = [
        { resource: validPatient() },
        { resource: { resourceType: 'Observation', id: 'obs-bad' } }, // missing required fields
      ];
      const bundle: Bundle = {
        resourceType: 'Bundle',
        id: 'bundle-2',
        type: 'batch',
        entry: entries,
      };

      const results = service.validateBundle(bundle);
      expect(results).toHaveLength(2);
      expect(results[0]!.valid).toBe(true);
      expect(results[1]!.valid).toBe(false);
    });
  });
});
