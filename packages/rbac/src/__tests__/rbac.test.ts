/**
 * packages/rbac/src/__tests__/rbac.test.ts
 *
 * Unit tests for the @caregiver/rbac package.
 *
 * Covers:
 *   - PERMISSION_MATRIX structural integrity (10 roles × 30 features, valid cells)
 *   - hasPermission() for known role+feature combinations
 *   - canAccess() conditional permission evaluation
 *   - getPermissions() / getRolePermissions()
 *   - RBAC_ROLES, FEATURES, ROLE_DISPLAY_NAMES, FEATURE_DOMAINS
 */
import { describe, it, expect } from 'vitest';

import { PERMISSION_MATRIX } from '../matrix.js';
import { hasPermission, canAccess, getPermissions, getRolePermissions } from '../guards.js';
import { RBAC_ROLES, ROLE_DISPLAY_NAMES, type Role } from '../roles.js';
import { FEATURES, FEATURE_DOMAINS } from '../features.js';
import type { Permission } from '../permission.js';

const VALID_PERMISSIONS: ReadonlyArray<Permission> = ['allow', 'deny', 'conditional'];

// ─── PERMISSION MATRIX STRUCTURE ───────────────────────────────
describe('PERMISSION_MATRIX structure', () => {
  it('has exactly 10 roles', () => {
    expect(Object.keys(PERMISSION_MATRIX)).toHaveLength(10);
  });

  // NOTE: the source doc-comments say "30 features" but the actual
  // FEATURES array contains 40 entries (8 domains × 5 features). The
  // matrix is typed Record<Role, Record<Feature, Permission>>, so every
  // role must have exactly as many cells as there are FEATURES.
  it('each role has exactly as many features as FEATURES (40)', () => {
    for (const role of RBAC_ROLES) {
      const features = Object.keys(PERMISSION_MATRIX[role]);
      expect(features, `role '${role}' should have ${FEATURES.length} features`).toHaveLength(
        FEATURES.length,
      );
    }
  });

  it('every cell is allow, deny, or conditional (no undefined)', () => {
    for (const role of RBAC_ROLES) {
      for (const feature of FEATURES) {
        const cell = PERMISSION_MATRIX[role][feature];
        expect(
          VALID_PERMISSIONS.includes(cell),
          `cell [${role}][${feature}] = '${cell}' is not a valid permission`,
        ).toBe(true);
      }
    }
  });

  it('every role key in the matrix is a known Role', () => {
    const knownRoles = new Set<string>(RBAC_ROLES);
    for (const roleKey of Object.keys(PERMISSION_MATRIX)) {
      expect(knownRoles.has(roleKey), `unknown role '${roleKey}' in matrix`).toBe(true);
    }
  });

  it('every feature key in each role is a known Feature', () => {
    const knownFeatures = new Set<string>(FEATURES);
    for (const role of RBAC_ROLES) {
      for (const featureKey of Object.keys(PERMISSION_MATRIX[role])) {
        expect(
          knownFeatures.has(featureKey),
          `unknown feature '${featureKey}' in role '${role}'`,
        ).toBe(true);
      }
    }
  });
});

// ─── hasPermission() ───────────────────────────────────────────
describe('hasPermission()', () => {
  it('admin + any feature = allow', () => {
    for (const feature of FEATURES) {
      expect(hasPermission('admin', feature), `admin + ${feature}`).toBe('allow');
    }
  });

  it("patient + appointment.view_by_clinic = 'deny'", () => {
    expect(hasPermission('patient', 'appointment.view_by_clinic')).toBe('deny');
  });

  it("patient + vitals.view = 'conditional'", () => {
    expect(hasPermission('patient', 'vitals.view')).toBe('conditional');
  });

  it("doctor + ai.request_diagnosis = 'allow'", () => {
    expect(hasPermission('doctor', 'ai.request_diagnosis')).toBe('allow');
  });

  it("nurse + order.lab_create = 'deny'", () => {
    expect(hasPermission('nurse', 'order.lab_create')).toBe('deny');
  });
});

// ─── canAccess() ───────────────────────────────────────────────
describe('canAccess() with conditional permissions', () => {
  it("patient + vitals.view + targetOwnerId=own userId → granted: true", () => {
    const result = canAccess('patient', 'vitals.view', {
      userId: 'p-123',
      role: 'patient',
      targetOwnerId: 'p-123',
    });
    expect(result.granted).toBe(true);
  });

  it("patient + vitals.view + targetOwnerId=different → granted: false", () => {
    const result = canAccess('patient', 'vitals.view', {
      userId: 'p-123',
      role: 'patient',
      targetOwnerId: 'p-456',
    });
    expect(result.granted).toBe(false);
  });

  it("patient + vitals.view + no targetOwnerId → granted: false", () => {
    const result = canAccess('patient', 'vitals.view', {
      userId: 'p-123',
      role: 'patient',
    });
    expect(result.granted).toBe(false);
  });

  it("doctor + vitals.record (allow) → granted: true regardless of context", () => {
    const result = canAccess('doctor', 'vitals.record', {
      userId: 'd-1',
      role: 'doctor',
      // no targetOwnerId — should still be granted because it's a static allow
    });
    expect(result.granted).toBe(true);
  });

  it("nurse + appointment.view_by_clinic (conditional) → granted: true (simplified rule)", () => {
    const result = canAccess('nurse', 'appointment.view_by_clinic', {
      userId: 'n-1',
      role: 'nurse',
    });
    expect(result.granted).toBe(true);
  });

  it("static deny returns granted: false", () => {
    const result = canAccess('nurse', 'order.lab_create', {
      userId: 'n-1',
      role: 'nurse',
    });
    expect(result.granted).toBe(false);
  });
});

// ─── getPermissions() ──────────────────────────────────────────
describe('getPermissions()', () => {
  it("returns only 'allow' and 'conditional' features (not 'deny')", () => {
    for (const role of RBAC_ROLES) {
      const perms = getPermissions(role);
      for (const feature of perms) {
        const p = hasPermission(role, feature);
        expect(
          p === 'allow' || p === 'conditional',
          `role '${role}' feature '${feature}' should not be 'deny' in getPermissions()`,
        ).toBe(true);
      }
    }
  });

  it("includes every 'allow' and 'conditional' feature for a role", () => {
    // Pick a role with a mix of allow/deny/conditional: patient
    const perms = getPermissions('patient');
    const expected = FEATURES.filter(
      (f) => hasPermission('patient', f) === 'allow' || hasPermission('patient', f) === 'conditional',
    );
    expect(perms.sort()).toEqual([...expected].sort());
  });
});

// ─── getRolePermissions() ──────────────────────────────────────
describe('getRolePermissions()', () => {
  it('returns all features for a role (40)', () => {
    for (const role of RBAC_ROLES) {
      const perms = getRolePermissions(role);
      expect(Object.keys(perms), `role '${role}'`).toHaveLength(FEATURES.length);
    }
  });

  it('returns a map whose values match the matrix', () => {
    const role: Role = 'doctor';
    const perms = getRolePermissions(role);
    for (const feature of FEATURES) {
      expect(perms[feature]).toBe(PERMISSION_MATRIX[role][feature]);
    }
  });
});

// ─── RBAC_ROLES ────────────────────────────────────────────────
describe('RBAC_ROLES', () => {
  it('has 10 entries', () => {
    expect(RBAC_ROLES).toHaveLength(10);
  });

  it('contains the expected roles', () => {
    expect([...RBAC_ROLES]).toEqual([
      'admin',
      'doctor',
      'nurse',
      'patient',
      'radiologist',
      'pharmacist',
      'billing_specialist',
      'lab_tech',
      'auditor',
      'medical_director',
    ]);
  });

  it('has no duplicate roles', () => {
    expect(new Set(RBAC_ROLES).size).toBe(RBAC_ROLES.length);
  });
});

// ─── FEATURES ──────────────────────────────────────────────────
describe('FEATURES', () => {
  // The doc-comments claim 30, but the array actually contains 40 entries
  // (8 domains × 5 features). We assert the real count.
  it('has 40 entries', () => {
    expect(FEATURES).toHaveLength(40);
  });

  it('has no duplicate features', () => {
    expect(new Set(FEATURES).size).toBe(FEATURES.length);
  });
});

// ─── ROLE_DISPLAY_NAMES ────────────────────────────────────────
describe('ROLE_DISPLAY_NAMES', () => {
  it('has all 10 roles', () => {
    expect(Object.keys(ROLE_DISPLAY_NAMES)).toHaveLength(10);
    for (const role of RBAC_ROLES) {
      expect(ROLE_DISPLAY_NAMES[role], `display name for '${role}'`).toBeDefined();
      expect(typeof ROLE_DISPLAY_NAMES[role]).toBe('string');
      expect(ROLE_DISPLAY_NAMES[role].length).toBeGreaterThan(0);
    }
  });
});

// ─── FEATURE_DOMAINS ───────────────────────────────────────────
describe('FEATURE_DOMAINS', () => {
  it('groups sum to the total feature count (40)', () => {
    const allDomainFeatures: string[] = [];
    for (const domain of Object.keys(FEATURE_DOMAINS)) {
      allDomainFeatures.push(...FEATURE_DOMAINS[domain as keyof typeof FEATURE_DOMAINS]);
    }
    expect(allDomainFeatures).toHaveLength(FEATURES.length);
  });

  it('every domain feature is a known Feature', () => {
    const known = new Set<string>(FEATURES);
    for (const domain of Object.keys(FEATURE_DOMAINS)) {
      for (const f of FEATURE_DOMAINS[domain as keyof typeof FEATURE_DOMAINS]) {
        expect(known.has(f), `domain feature '${f}' is not a known Feature`).toBe(true);
      }
    }
  });

  it('has no duplicate features across domains', () => {
    const allDomainFeatures: string[] = [];
    for (const domain of Object.keys(FEATURE_DOMAINS)) {
      allDomainFeatures.push(...FEATURE_DOMAINS[domain as keyof typeof FEATURE_DOMAINS]);
    }
    expect(new Set(allDomainFeatures).size).toBe(allDomainFeatures.length);
  });

  it('covers every feature in FEATURES', () => {
    const domainSet = new Set<string>();
    for (const domain of Object.keys(FEATURE_DOMAINS)) {
      for (const f of FEATURE_DOMAINS[domain as keyof typeof FEATURE_DOMAINS]) {
        domainSet.add(f);
      }
    }
    for (const feature of FEATURES) {
      expect(domainSet.has(feature), `feature '${feature}' not in any domain`).toBe(true);
    }
  });
});
