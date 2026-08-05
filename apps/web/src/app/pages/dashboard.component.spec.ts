/**
 * apps/web/src/app/pages/dashboard.component.spec.ts
 *
 * Unit tests for DashboardComponent — the role-based quick actions and
 * feature cards computed from the @caregiver/rbac permission matrix.
 *
 * AuthService is replaced with a lightweight mock exposing only the
 * `currentUser` signal the component reads, and `provideRouter([])`
 * satisfies the RouterLink directive's dependencies so the rendered
 * anchors get real `href` values.
 *
 * The expected quick-action/feature-card sets below are derived directly
 * from the canonical matrix in packages/rbac/src/matrix.ts — if that matrix
 * changes, these tests (and the dashboard) stay correct because the
 * component itself reads from the same source.
 */
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../services/auth.service';
import { getRolePermissions, ROLE_DISPLAY_NAMES, type Role, type Feature } from '@caregiver/rbac';
import type { UserProfile } from '@caregiver/contracts';

function makeUser(role: Role, fullName = 'Test User'): UserProfile {
  return {
    id: `user-${role}`,
    email: `${role}@caregiver.test`,
    fullName,
    role,
    isActive: true,
  };
}

describe('DashboardComponent', () => {
  function createDashboard(user: UserProfile | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: signal(user) } },
      ],
    });
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  // ── Header / role strip ────────────────────────────────────

  it('renders the welcome message with the user full name', () => {
    const { fixture } = createDashboard(makeUser('doctor', 'Dr. Ada Lovelace'));

    expect(fixture.nativeElement.textContent).toContain('Dr. Ada Lovelace');
  });

  it('renders the human-readable role display name badge', () => {
    const { component, fixture } = createDashboard(makeUser('medical_director'));

    expect(component.displayName()).toBe(ROLE_DISPLAY_NAMES.medical_director);
    expect(fixture.nativeElement.textContent).toContain(ROLE_DISPLAY_NAMES.medical_director);
  });

  it('derives the role insight feature counts from the real RBAC matrix', () => {
    const { component } = createDashboard(makeUser('doctor'));

    const insight = component.roleInsights();
    expect(insight).not.toBeNull();

    const perms = getRolePermissions('doctor');
    const features = Object.keys(perms) as Feature[];
    expect(insight!.totalFeatures).toBe(features.length);
    expect(insight!.availableFeatures).toBe(features.filter((f) => perms[f] !== 'deny').length);
    expect(insight!.description.length).toBeGreaterThan(0);
  });

  // ── Quick actions (RBAC-gated) ─────────────────────────────

  it('shows the 4 most common actions for a doctor', () => {
    const { component } = createDashboard(makeUser('doctor'));

    expect(component.quickActions().map((a) => a.label)).toEqual([
      'Schedule appointment',
      'Record vitals',
      'Request AI diagnosis',
      'New clinical order',
    ]);
  });

  it('surfaces conditional permissions as usable actions for a patient', () => {
    // patient's appointment.schedule + fhir.view are 'conditional' (own
    // records only), which the dashboard treats as usable — not 'deny'.
    const { component } = createDashboard(makeUser('patient'));

    expect(component.quickActions().map((a) => a.label)).toEqual([
      'Schedule appointment',
      'Browse FHIR resources',
    ]);
  });

  it('shows read-only actions for an auditor (no write actions)', () => {
    const { component } = createDashboard(makeUser('auditor'));

    expect(component.quickActions().map((a) => a.label)).toEqual([
      'Browse FHIR resources',
      'View audit trail',
    ]);
  });

  it('caps quick actions at 4 even for a role with full access', () => {
    const { component } = createDashboard(makeUser('admin'));

    expect(component.quickActions().length).toBe(4);
  });

  it('renders quick action chips with correct router links', () => {
    const { fixture } = createDashboard(makeUser('doctor'));

    const chips = fixture.nativeElement.querySelectorAll('.quick-action-chip');
    expect(chips.length).toBe(4);
    expect(chips[0].getAttribute('href')).toBe('/appointments');
    expect(chips[0].textContent).toContain('Schedule appointment');
    expect(chips[3].getAttribute('href')).toBe('/orders');
  });

  // ── Feature cards ──────────────────────────────────────────

  it('shows only feature domains the role has any access to', () => {
    // patient has no orders/billing/audit access → those cards are absent.
    const { component } = createDashboard(makeUser('patient'));

    expect(component.featureCards().map((c) => c.title)).toEqual([
      'Appointments',
      'Vital Signs',
      'AI Diagnostics',
      'FHIR Resources',
    ]);
  });

  it('shows all 7 feature domains for an admin', () => {
    const { component } = createDashboard(makeUser('admin'));

    expect(component.featureCards().length).toBe(7);
  });

  // ── Unauthenticated / no user ──────────────────────────────

  it('renders nothing role-dependent when there is no user', () => {
    const { component, fixture } = createDashboard(null);

    expect(component.displayName()).toBe('');
    expect(component.roleInsights()).toBeNull();
    expect(component.quickActions()).toEqual([]);
    expect(component.featureCards()).toEqual([]);
    expect(fixture.nativeElement.textContent).not.toContain('Quick Actions');
  });
});
