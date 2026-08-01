/**
 * apps/api/src/auth/__tests__/auth.service.spec.ts
 *
 * Unit tests for AuthService.
 *
 * The AuthService calls `createDb()` directly in its constructor (not via DI),
 * so we mock the `@caregiver/db` module with `vi.mock()` and use `vi.hoisted()`
 * to share mutable result containers between the mock factory and the tests.
 * `drizzle-orm` is also mocked so `eq()` is a no-op (the chainable query mock
 * ignores its arguments anyway).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service.js';

// NOTE: AuthService uses type-based constructor DI (`jwtService: JwtService`),
// which relies on `design:paramtypes` metadata emitted by tsc. Vitest
// transforms with esbuild, which does not emit that metadata, so NestJS DI
// cannot resolve the JwtService by type. We therefore instantiate the
// service directly with a mock JwtService. The `createDb()` call in the
// constructor is still intercepted by the `vi.mock('@caregiver/db')` below.

// ── Hoisted mock state ──────────────────────────────────────────
// `vi.hoisted()` runs before any import, so the objects it returns are
// available inside the `vi.mock()` factories below.
const mockState = vi.hoisted(() => {
  // Mutable result containers — tests set these before invoking the service.
  const selectResult = { current: [] as unknown[] };
  const insertResult = { current: [] as unknown[] };
  const updateResult = { current: [] as unknown[] };

  /**
   * Build a chainable Drizzle query mock.
   * Every chain method returns the chain itself; the terminal methods
   * (`limit`, `returning`) resolve to the current value of `ref.current`.
   */
  const makeChain = (ref: { current: unknown[] }) => {
    const c: Record<string, ReturnType<typeof vi.fn>> = {};
    c.from = vi.fn(() => c);
    c.where = vi.fn(() => c);
    c.orderBy = vi.fn(() => c);
    c.limit = vi.fn(() => Promise.resolve(ref.current));
    c.values = vi.fn(() => c);
    c.set = vi.fn(() => c);
    c.returning = vi.fn(() => Promise.resolve(ref.current));
    return c;
  };

  const selectChain = makeChain(selectResult);
  const insertChain = makeChain(insertResult);
  const updateChain = makeChain(updateResult);

  const db = {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
  };

  return { db, selectResult, insertResult, updateResult };
});

// Mock drizzle-orm — `eq` is only used to build a WHERE clause that the
// chainable mock ignores, so a no-op stub is sufficient.
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));

// Mock bcrypt — login() calls bcrypt.compare() with the plaintext password
// and the stored hash. The test users use plaintext placeholders for
// passwordHash, so compare matches when the two strings are equal.
vi.mock('bcrypt', () => ({
  compare: vi.fn(async (data: string, hash: string) => data === hash),
  hash: vi.fn(async (data: string) => `hashed:${data}`),
}));

// Mock @caregiver/db — createDb returns our chainable mock DB; schema is a
// dummy object whose properties are never inspected at runtime.
vi.mock('@caregiver/db', () => ({
  createDb: () => mockState.db,
  schema: {
    users: { id: 'id', email: 'email' },
    appointments: { id: 'id' },
    vitals: { id: 'id', patientId: 'patientId', recordedAt: 'recordedAt' },
    aiDiagnoses: { id: 'id' },
  },
}));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  // A canonical active user returned by the DB for happy-path tests.
  const mockUser = {
    id: 'user-123',
    email: 'doctor@caregiver.test',
    passwordHash: 'correct-password',
    fullName: 'Dr. Jane Smith',
    role: 'doctor',
    isActive: true,
    fhirResourceId: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    // Reset result containers + mock call history before each test.
    mockState.selectResult.current = [];
    mockState.insertResult.current = [];
    mockState.updateResult.current = [];

    // Mock JwtService — `sign` returns a deterministic token; `verify` is
    // configured per-test where needed.
    jwtService = { sign: vi.fn(() => 'signed-token'), verify: vi.fn() } as unknown as JwtService;

    // Instantiate directly (see note at top of file re: esbuild + DI metadata).
    service = new AuthService(jwtService);
  });

  // ── login() ──────────────────────────────────────────────────

  describe('login()', () => {
    it('returns tokens + user profile with valid credentials', async () => {
      mockState.selectResult.current = [mockUser];

      const result = await service.login({
        email: 'doctor@caregiver.test',
        password: 'correct-password',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(900);
      expect(result.user).toEqual({
        id: 'user-123',
        email: 'doctor@caregiver.test',
        fullName: 'Dr. Jane Smith',
        role: 'doctor',
        isActive: true,
      });
      // JWT signed twice: access token + refresh token.
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('throws UnauthorizedException for an unknown email', async () => {
      mockState.selectResult.current = []; // no user found

      await expect(
        service.login({ email: 'nobody@caregiver.test', password: 'any' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for a wrong password', async () => {
      mockState.selectResult.current = [mockUser];

      await expect(
        service.login({ email: 'doctor@caregiver.test', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for an inactive user', async () => {
      mockState.selectResult.current = [{ ...mockUser, isActive: false }];

      await expect(
        service.login({ email: 'doctor@caregiver.test', password: 'correct-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ── validateUser() ───────────────────────────────────────────

  describe('validateUser()', () => {
    it('returns the user profile for a valid, active user ID', async () => {
      mockState.selectResult.current = [mockUser];

      const profile = await service.validateUser('user-123');

      expect(profile).toEqual({
        id: 'user-123',
        email: 'doctor@caregiver.test',
        fullName: 'Dr. Jane Smith',
        role: 'doctor',
        isActive: true,
      });
    });

    it('returns null when no user matches the ID', async () => {
      mockState.selectResult.current = [];

      const profile = await service.validateUser('does-not-exist');

      expect(profile).toBeNull();
    });
  });
});
