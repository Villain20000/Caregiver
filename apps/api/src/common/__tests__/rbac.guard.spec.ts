/**
 * apps/api/src/common/__tests__/rbac.guard.spec.ts
 *
 * Unit tests for RbacGuard.
 *
 * The guard reads the required feature from route metadata via `Reflector`
 * and evaluates it with the real `canAccess()` from @caregiver/rbac (pure
 * logic, no I/O). We mock `Reflector` to control the metadata and mock the
 * `ExecutionContext` to control the request (user, params, body).
 *
 * Permission cases (from the canonical PERMISSION_MATRIX):
 *   - 'allow'       → doctor + 'appointment.schedule'
 *   - 'deny'        → patient + 'ai.request_diagnosis'
 *   - 'conditional' → patient + 'vitals.view' (own records only)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { RbacGuard, PERMISSION_KEY } from '../rbac.guard.js';
import type { UserProfile } from '@caregiver/contracts';

/** Build a mock ExecutionContext with a configurable HTTP request. */
function createMockContext(request: {
  user?: UserProfile;
  params?: Record<string, string>;
  body?: Record<string, unknown>;
}): ExecutionContext {
  return {
    getHandler: vi.fn(() => 'mockHandler'),
    getClass: vi.fn(() => ({ name: 'VitalsController' })),
    switchToHttp: vi.fn(() => ({
      getRequest: vi.fn(() => request),
    })),
  } as unknown as ExecutionContext;
}

/** Build a mock Reflector that returns the given feature for PERMISSION_KEY. */
function createMockReflector(feature: string | undefined): Reflector {
  return {
    getAllAndOverride: vi.fn((key: string) =>
      key === PERMISSION_KEY ? feature : undefined,
    ),
  } as unknown as Reflector;
}

describe('RbacGuard', () => {
  let guard: RbacGuard;

  const doctor: UserProfile = {
    id: 'doctor-1',
    email: 'doctor@caregiver.test',
    fullName: 'Dr. Jane',
    role: 'doctor',
    isActive: true,
  };

  const patient: UserProfile = {
    id: 'patient-1',
    email: 'patient@caregiver.test',
    fullName: 'Pat Smith',
    role: 'patient',
    isActive: true,
  };

  beforeEach(() => {
    // A fresh guard with a no-op reflector; each test overrides the reflector.
    guard = new RbacGuard(createMockReflector(undefined));
  });

  it('allows the request when no permission is required', () => {
    guard = new RbacGuard(createMockReflector(undefined));
    const ctx = createMockContext({ user: doctor, params: {}, body: {} });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows when the role has an "allow" permission for the feature', () => {
    // doctor + 'appointment.schedule' → 'allow' in the matrix.
    guard = new RbacGuard(createMockReflector('appointment.schedule'));
    const ctx = createMockContext({ user: doctor, params: {}, body: {} });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when the role has a "deny" permission', () => {
    // patient + 'ai.request_diagnosis' → 'deny' in the matrix.
    guard = new RbacGuard(createMockReflector('ai.request_diagnosis'));
    const ctx = createMockContext({ user: patient, params: {}, body: {} });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows a "conditional" permission when the patient owns the resource', () => {
    // patient + 'vitals.view' → 'conditional'; targetOwnerId === userId.
    guard = new RbacGuard(createMockReflector('vitals.view'));
    const ctx = createMockContext({
      user: patient,
      params: {},
      body: { patientId: 'patient-1' }, // matches the patient's own ID
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException for a "conditional" permission when the owner differs', () => {
    // patient + 'vitals.view' → 'conditional'; targetOwnerId !== userId.
    guard = new RbacGuard(createMockReflector('vitals.view'));
    const ctx = createMockContext({
      user: patient,
      params: {},
      body: { patientId: 'patient-999' }, // another patient's record
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no authenticated user', () => {
    guard = new RbacGuard(createMockReflector('appointment.schedule'));
    // No `user` on the request (JwtAuthGuard did not run / failed to set it).
    const ctx = createMockContext({ params: {}, body: {} });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
