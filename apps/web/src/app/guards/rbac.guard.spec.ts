/**
 * apps/web/src/app/guards/rbac.guard.spec.ts
 *
 * Unit tests for the rbacGuard functional route guard.
 *
 * The guard is executed inside TestBed's injection context via
 * `TestBed.runInInjectionContext` so that `inject(AuthService)` and
 * `inject(Router)` resolve to the provided mocks. The permission lookup
 * runs against the REAL @caregiver/rbac permission matrix (the karma build
 * resolves it via `resolve.extensionAlias` — see karma.webpack.config.cjs).
 *
 * Matrix values exercised here (per packages/rbac):
 *   - doctor   + ai.request_diagnosis        → 'allow' (guard allows)
 *   - patient  + vitals.view                 → 'conditional' (guard allows)
 *   - patient  + appointment.view_by_clinic  → 'deny' (guard redirects)
 */
import { TestBed } from '@angular/core/testing';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { rbacGuard, REQUIRED_PERMISSION_KEY } from './rbac.guard';

describe('rbacGuard', () => {
  let routerSpy: jasmine.SpyObj<Pick<Router, 'navigate'>>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));
  });

  /** Build a route snapshot with optional requiredPermission data. */
  function makeRoute(requiredPermission?: string): ActivatedRouteSnapshot {
    const data = requiredPermission ? { [REQUIRED_PERMISSION_KEY]: requiredPermission } : {};
    return { data } as ActivatedRouteSnapshot;
  }

  /** Configure mocks and run the guard in the TestBed injection context. */
  function runGuard(role: string | null, requiredPermission?: string): boolean {
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: AuthService, useValue: { userRole: () => role } },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      rbacGuard(makeRoute(requiredPermission), { url: '/' } as RouterStateSnapshot),
    );
    return result === true;
  }

  it('allows access when no permission is required', () => {
    const allowed = runGuard('doctor');

    expect(allowed).toBe(true);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('allows access when the role has allow permission', () => {
    const allowed = runGuard('doctor', 'ai.request_diagnosis');

    expect(allowed).toBe(true);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('allows access for conditional permissions', () => {
    const allowed = runGuard('patient', 'vitals.view');

    expect(allowed).toBe(true);
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('denies and redirects to the dashboard when the permission is deny', () => {
    const allowed = runGuard('patient', 'appointment.view_by_clinic');

    expect(allowed).toBe(false);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('denies and redirects when the user has no role', () => {
    const allowed = runGuard(null, 'ai.request_diagnosis');

    expect(allowed).toBe(false);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
