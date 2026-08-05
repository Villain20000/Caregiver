/**
 * apps/web/src/app/services/audit.service.spec.ts
 *
 * Unit tests for AuditService — the audit trail query API client.
 *
 * Follows the auth.service.spec.ts pattern: HttpClient is replaced with a
 * jasmine SpyObj, and each method's HTTP verb, URL, and query params are
 * asserted directly. Query params are built conditionally, so specs cover
 * both the empty and populated param maps.
 */
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AuditService } from './audit.service';
import type { AuditResponse } from '@caregiver/contracts';

describe('AuditService', () => {
  let httpSpy: jasmine.SpyObj<Pick<HttpClient, 'get'>>;

  const mockEntry: AuditResponse = {
    id: 'log-1',
    userId: 'user-1',
    userRole: 'doctor',
    action: 'diagnose',
    resourceType: 'Patient',
    resourceId: 'pat-1',
    result: 'success',
    errorMessage: null,
    sourceIp: '10.0.0.1',
    serviceName: 'api',
    details: null,
    occurredAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['get']);
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpy }],
    });
  });

  function createService(): AuditService {
    return TestBed.inject(AuditService);
  }

  it('lists audit logs without params by default', () => {
    httpSpy.get.and.returnValue(of([mockEntry]));
    const service = createService();

    let received: AuditResponse[] = [];
    service.listAuditLogs().subscribe((logs) => (received = logs));

    expect(httpSpy.get).toHaveBeenCalledWith('/api/audit', { params: {} });
    expect(received.length).toBe(1);
  });

  it('passes limit and offset as query params', () => {
    httpSpy.get.and.returnValue(of([mockEntry]));
    const service = createService();

    service.listAuditLogs(50, 10).subscribe();

    expect(httpSpy.get).toHaveBeenCalledWith('/api/audit', {
      params: { limit: '50', offset: '10' },
    });
  });

  it('fetches logs for a user with a limit', () => {
    httpSpy.get.and.returnValue(of([mockEntry]));
    const service = createService();

    service.getByUser('user-1', 20).subscribe();

    expect(httpSpy.get).toHaveBeenCalledWith('/api/audit/user/user-1', {
      params: { limit: '20' },
    });
  });

  it('fetches logs for a user without a limit', () => {
    httpSpy.get.and.returnValue(of([mockEntry]));
    const service = createService();

    service.getByUser('user-1').subscribe();

    expect(httpSpy.get).toHaveBeenCalledWith('/api/audit/user/user-1', { params: {} });
  });

  it('fetches logs for a resource type and id with a limit', () => {
    httpSpy.get.and.returnValue(of([mockEntry]));
    const service = createService();

    service.getByResource('Patient', 'pat-1', 5).subscribe();

    expect(httpSpy.get).toHaveBeenCalledWith('/api/audit/resource/Patient/pat-1', {
      params: { limit: '5' },
    });
  });

  it('fetches logs for a resource type and id without a limit', () => {
    httpSpy.get.and.returnValue(of([mockEntry]));
    const service = createService();

    service.getByResource('Observation', 'obs-1').subscribe();

    expect(httpSpy.get).toHaveBeenCalledWith('/api/audit/resource/Observation/obs-1', {
      params: {},
    });
  });
});
