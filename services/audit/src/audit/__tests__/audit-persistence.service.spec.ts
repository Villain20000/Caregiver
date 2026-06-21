/**
 * services/audit/src/audit/__tests__/audit-persistence.service.spec.ts
 *
 * Unit tests for AuditPersistenceService — append-only INSERT writer for
 * the audit_log table.
 *
 * The Drizzle Database is mocked so no real Postgres connection is needed.
 * The append-only invariant (never UPDATE, never DELETE) is asserted.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AuditEventPayload } from '@caregiver/contracts';
import { AuditPersistenceService } from '../audit-persistence.service.js';

// ── Mock @caregiver/db so no real DB connection is opened ───────
// The service calls `createDb()` in its constructor and then uses
// `db.insert(schema.auditLog).values(...).returning()`.
const mockReturning = vi.fn();
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
const mockDb = { insert: mockInsert };

vi.mock('@caregiver/db', () => ({
  createDb: () => mockDb,
  schema: { auditLog: 'audit_log' },
}));

describe('AuditPersistenceService', () => {
  let service: AuditPersistenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([
      {
        id: 'generated-uuid',
        userId: 'user-1',
        userRole: 'doctor',
        action: 'create',
        resourceType: 'Patient',
        resourceId: 'patient-1',
        result: 'success',
        errorMessage: null,
        sourceIp: '10.0.0.1',
        serviceName: 'api',
        details: { foo: 'bar' },
        occurredAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ]);
    service = new AuditPersistenceService();
  });

  const fullPayload: AuditEventPayload = {
    userId: 'user-1',
    userRole: 'doctor',
    action: 'create',
    resourceType: 'Patient',
    resourceId: 'patient-1',
    result: 'success',
    errorMessage: undefined,
    sourceIp: '10.0.0.1',
    serviceName: 'api',
    details: { foo: 'bar' },
    occurredAt: '2024-01-01T00:00:00.000Z',
  };

  it('persist() with a full payload calls db.insert with the correct mapping', async () => {
    const row = await service.persist(fullPayload);

    // insert was called once with the auditLog table.
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith('audit_log');

    // values() called once with the mapped row.
    expect(mockValues).toHaveBeenCalledTimes(1);
    const valuesArg = mockValues.mock.calls[0]![0];
    expect(valuesArg).toMatchObject({
      userId: 'user-1',
      userRole: 'doctor',
      action: 'create',
      resourceType: 'Patient',
      resourceId: 'patient-1',
      result: 'success',
      sourceIp: '10.0.0.1',
      serviceName: 'api',
      details: { foo: 'bar' },
    });
    // occurredAt is converted to a Date.
    expect(valuesArg.occurredAt).toBeInstanceOf(Date);
    expect(valuesArg.occurredAt.toISOString()).toBe('2024-01-01T00:00:00.000Z');

    // The inserted row is returned.
    expect(row).toMatchObject({ id: 'generated-uuid', action: 'create' });
    expect(mockReturning).toHaveBeenCalledTimes(1);
  });

  it('persist() with a minimal payload (only required fields) still inserts successfully', async () => {
    const minimal: AuditEventPayload = {
      action: 'login',
      result: 'success',
      serviceName: 'api',
      occurredAt: '2024-06-01T12:00:00.000Z',
    };

    const row = await service.persist(minimal);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledTimes(1);
    const valuesArg = mockValues.mock.calls[0]![0];
    expect(valuesArg.action).toBe('login');
    expect(valuesArg.result).toBe('success');
    expect(valuesArg.serviceName).toBe('api');
    expect(valuesArg.occurredAt).toBeInstanceOf(Date);
    expect(row).toBeDefined();
  });

  it('persist() with optional fields missing inserts with undefined (→ NULL) values', async () => {
    const partial: AuditEventPayload = {
      action: 'read',
      result: 'failure',
      serviceName: 'fhir-ingestion',
      occurredAt: '2024-06-01T12:00:00.000Z',
      // sourceIp, errorMessage, details, userId, userRole, resourceType,
      // resourceId all omitted.
    };

    await service.persist(partial);
    const valuesArg = mockValues.mock.calls[0]![0];
    expect(valuesArg.sourceIp).toBeUndefined();
    expect(valuesArg.errorMessage).toBeUndefined();
    expect(valuesArg.details).toBeUndefined();
    expect(valuesArg.userId).toBeUndefined();
    expect(valuesArg.userRole).toBeUndefined();
    expect(valuesArg.resourceType).toBeUndefined();
    expect(valuesArg.resourceId).toBeUndefined();
  });

  it('NEVER calls update or delete (append-only invariant)', async () => {
    await service.persist(fullPayload);

    // The mocked DB only exposes `insert`; assert update/delete are absent.
    expect(mockDb).not.toHaveProperty('update');
    expect(mockDb).not.toHaveProperty('delete');

    // And that only insert was invoked — no other mutating method exists.
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});
