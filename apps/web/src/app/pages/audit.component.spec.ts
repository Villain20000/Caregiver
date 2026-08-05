/**
 * apps/web/src/app/pages/audit.component.spec.ts
 *
 * Unit tests for AuditComponent — audit log loading, filter/search routing
 * (by user, by resource, unfiltered), reset, and table rendering.
 *
 * AuthService is mocked with `currentUser` + `userRole` signals; AuditService
 * is a jasmine spy. The component has no child components.
 */
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AuditComponent } from './audit.component';
import { AuthService } from '../services/auth.service';
import { AuditService } from '../services/audit.service';
import type { UserProfile, AuditResponse } from '@caregiver/contracts';

function makeUser(role: UserProfile['role'], id = `user-${role}`): UserProfile {
  return { id, email: `${role}@caregiver.test`, fullName: 'Test User', role, isActive: true };
}

function makeLog(overrides: Partial<AuditResponse> = {}): AuditResponse {
  return {
    id: 'log-1',
    userId: 'user-1',
    userRole: 'doctor',
    action: 'vitals.record',
    resourceType: 'Observation',
    resourceId: 'obs-1',
    result: 'success',
    errorMessage: null,
    sourceIp: '10.0.0.1',
    serviceName: 'vitals-service',
    details: null,
    occurredAt: '2026-01-01T12:00:00.000Z',
    ...overrides,
  };
}

describe('AuditComponent', () => {
  let auditService: jasmine.SpyObj<
    Pick<AuditService, 'listAuditLogs' | 'getByUser' | 'getByResource'>
  >;

  beforeEach(() => {
    auditService = jasmine.createSpyObj('AuditService', [
      'listAuditLogs',
      'getByUser',
      'getByResource',
    ]);
    auditService.listAuditLogs.and.returnValue(of([]));
    auditService.getByUser.and.returnValue(of([]));
    auditService.getByResource.and.returnValue(of([]));
  });

  function createAudit(user: UserProfile | null) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { currentUser: signal(user), userRole: signal(user?.role ?? null) },
        },
        { provide: AuditService, useValue: auditService },
      ],
    });
    const fixture = TestBed.createComponent(AuditComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  // ── Data loading ────────────────────────────────────────────

  it('loads audit logs on init and renders them in the table', async () => {
    auditService.listAuditLogs.and.returnValue(
      of([makeLog(), makeLog({ id: 'log-2', result: 'failure' })]),
    );
    const { component, fixture } = createAudit(makeUser('auditor'));

    expect(auditService.listAuditLogs).toHaveBeenCalled();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.logs().length).toBe(2);
    const rows = fixture.nativeElement.querySelectorAll('.audit-table tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0]?.textContent).toContain('vitals.record');
    expect(rows[1]?.classList.contains('failure')).toBe(true);
  });

  it('shows the empty state when there are no logs', async () => {
    const { fixture } = createAudit(makeUser('auditor'));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No audit logs found.');
  });

  it('surfaces an error banner when logs fail to load', async () => {
    auditService.listAuditLogs.and.returnValue(throwError(() => new Error('boom')));
    const { component, fixture } = createAudit(makeUser('auditor'));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBe('Failed to load audit logs.');
    expect(fixture.nativeElement.textContent).toContain('Failed to load audit logs.');
  });

  // ── Filter routing ──────────────────────────────────────────

  it('searches by user id when only that filter is set', async () => {
    auditService.getByUser.and.returnValue(of([makeLog({ userId: 'user-42' })]));
    const { component, fixture } = createAudit(makeUser('auditor'));
    await fixture.whenStable();

    component.filterForm.controls.userId.setValue('user-42');
    await component.onSearch();
    fixture.detectChanges();

    expect(auditService.getByUser).toHaveBeenCalledWith('user-42');
    expect(component.logs()[0]?.userId).toBe('user-42');
    expect(auditService.listAuditLogs).toHaveBeenCalledTimes(1); // only the init call
  });

  it('searches by resource type + id when both are set', async () => {
    const { component, fixture } = createAudit(makeUser('auditor'));
    await fixture.whenStable();

    component.filterForm.controls.resourceType.setValue('Patient');
    component.filterForm.controls.resourceId.setValue('pat-9');
    await component.onSearch();

    expect(auditService.getByResource).toHaveBeenCalledWith('Patient', 'pat-9');
  });

  it('falls back to the full log list when no filters are set', async () => {
    const { component, fixture } = createAudit(makeUser('auditor'));
    await fixture.whenStable();

    await component.onSearch();

    expect(auditService.listAuditLogs).toHaveBeenCalledTimes(2);
    expect(auditService.getByUser).not.toHaveBeenCalled();
    expect(auditService.getByResource).not.toHaveBeenCalled();
  });

  it('surfaces a user-filter error separately', async () => {
    auditService.getByUser.and.returnValue(throwError(() => new Error('boom')));
    const { component } = createAudit(makeUser('auditor'));

    component.filterForm.controls.userId.setValue('user-1');
    await component.onSearch();

    expect(component.error()).toBe('Failed to load audit logs by user.');
  });

  // ── Reset ───────────────────────────────────────────────────

  it('resets the filter form and reloads the full log list', async () => {
    auditService.getByUser.and.returnValue(of([makeLog()]));
    const { component, fixture } = createAudit(makeUser('auditor'));
    await fixture.whenStable();

    component.filterForm.controls.userId.setValue('user-42');
    await component.onSearch();
    expect(auditService.getByUser).toHaveBeenCalled();

    await component.onReset();

    expect(component.filterForm.getRawValue()).toEqual({
      userId: '',
      resourceType: '',
      resourceId: '',
    });
    expect(auditService.listAuditLogs).toHaveBeenCalledTimes(2);
  });
});
