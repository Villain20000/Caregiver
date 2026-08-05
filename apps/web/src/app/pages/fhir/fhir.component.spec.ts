/**
 * apps/web/src/app/pages/fhir/fhir.component.spec.ts
 *
 * Unit tests for FhirComponent — resource loading, RBAC-gated search/ingest,
 * search criteria handling, bundle ingestion, and detail toggling.
 *
 * AuthService is mocked with `currentUser` + `userRole` signals; FhirService
 * is a jasmine spy. Child components (app-fhir-search / app-fhir-resource-list)
 * are rendered for real — they are presentational and dependency-free.
 */
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { FhirComponent } from './fhir.component';
import { AuthService } from '../../services/auth.service';
import {
  FhirService,
  type FhirResourceResponse,
  type IngestSummary,
} from '../../services/fhir.service';
import type { UserProfile } from '@caregiver/contracts';

function makeUser(role: UserProfile['role'], id = `user-${role}`): UserProfile {
  return { id, email: `${role}@caregiver.test`, fullName: 'Test User', role, isActive: true };
}

function makeResource(overrides: Partial<FhirResourceResponse> = {}): FhirResourceResponse {
  return {
    id: 'res-1',
    resourceType: 'Patient',
    fhirId: 'pat-fhir-1',
    resource: { resourceType: 'Patient', id: 'pat-fhir-1' },
    validationStatus: 'valid',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeIngestSummary(overrides: Partial<IngestSummary> = {}): IngestSummary {
  return { valid: true, totalResources: 3, validResources: 2, invalidResources: 1, ...overrides };
}

describe('FhirComponent', () => {
  let fhirService: jasmine.SpyObj<Pick<FhirService, 'searchResources' | 'ingestBundle'>>;

  beforeEach(() => {
    fhirService = jasmine.createSpyObj('FhirService', ['searchResources', 'ingestBundle']);
    fhirService.searchResources.and.returnValue(of([]));
    fhirService.ingestBundle.and.returnValue(of(makeIngestSummary()));
  });

  function createFhir(user: UserProfile | null) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { currentUser: signal(user), userRole: signal(user?.role ?? null) },
        },
        { provide: FhirService, useValue: fhirService },
      ],
    });
    const fixture = TestBed.createComponent(FhirComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  // ── Data loading ────────────────────────────────────────────

  it('loads resources on init', async () => {
    fhirService.searchResources.and.returnValue(of([makeResource()]));
    const { component, fixture } = createFhir(makeUser('doctor'));

    expect(fhirService.searchResources).toHaveBeenCalledWith();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.resources().length).toBe(1);
    expect(component.error()).toBeNull();
  });

  it('surfaces an error banner when resources fail to load', async () => {
    fhirService.searchResources.and.returnValue(throwError(() => new Error('boom')));
    const { component, fixture } = createFhir(makeUser('doctor'));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBe('Failed to load FHIR resources.');
    expect(fixture.nativeElement.textContent).toContain('Failed to load FHIR resources.');
  });

  // ── RBAC gating ─────────────────────────────────────────────

  it('allows admin to search and ingest', () => {
    const { component } = createFhir(makeUser('admin'));

    expect(component.canSearch()).toBe(true);
    expect(component.canIngest()).toBe(true);
  });

  it('allows doctor to search but not ingest', () => {
    const { component, fixture } = createFhir(makeUser('doctor'));

    expect(component.canSearch()).toBe(true);
    expect(component.canIngest()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Ingest FHIR Bundle');
  });

  it('denies search and ingest to patients', () => {
    const { component, fixture } = createFhir(makeUser('patient'));

    expect(component.canSearch()).toBe(false);
    expect(component.canIngest()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Search Resources');
  });

  // ── Search ──────────────────────────────────────────────────

  it('forwards search criteria to the service and clears the expanded detail', async () => {
    fhirService.searchResources.and.returnValue(of([makeResource()]));
    const { component } = createFhir(makeUser('doctor'));

    component.toggleResource('res-1');
    expect(component.expandedId()).toBe('res-1');

    await component.onSearch({ resourceType: 'Observation', search: 'obs-42' });

    expect(fhirService.searchResources).toHaveBeenCalledWith('Observation', 'obs-42');
    expect(component.resources().length).toBe(1);
    expect(component.expandedId()).toBeNull();
  });

  it('surfaces an error when a search fails', async () => {
    fhirService.searchResources.and.returnValue(throwError(() => new Error('boom')));
    const { component } = createFhir(makeUser('doctor'));

    await component.onSearch({ resourceType: '', search: '' });

    expect(component.error()).toBe('Failed to search FHIR resources.');
  });

  // ── Ingestion ───────────────────────────────────────────────

  it('ingests a parsed bundle, shows a summary, and reloads resources', async () => {
    fhirService.searchResources.and.returnValue(of([makeResource()]));
    const { component, fixture } = createFhir(makeUser('admin'));
    await fixture.whenStable();

    await component.onIngest({
      sourceSystem: 'epic',
      bundleJson: JSON.stringify({ resourceType: 'Bundle', entry: [] }),
    });

    expect(fhirService.ingestBundle).toHaveBeenCalledWith(
      { resourceType: 'Bundle', entry: [] },
      'epic',
    );
    expect(component.ingestResult()).toBe('Ingested: 2 valid, 1 invalid of 3');
    // Resources reloaded after a successful ingestion.
    expect(fhirService.searchResources).toHaveBeenCalledTimes(2);
  });

  it('reports a bare success message when the ingest summary is missing', async () => {
    fhirService.ingestBundle.and.returnValue(of(undefined as unknown as IngestSummary));
    const { component } = createFhir(makeUser('admin'));

    await component.onIngest({ sourceSystem: 'epic', bundleJson: '{}' });

    expect(component.ingestResult()).toBe('Ingestion complete.');
  });

  it('surfaces an error when the bundle JSON is malformed', async () => {
    const { component } = createFhir(makeUser('admin'));

    await component.onIngest({ sourceSystem: 'epic', bundleJson: '{not-valid-json' });

    expect(fhirService.ingestBundle).not.toHaveBeenCalled();
    expect(component.error()).toBe('Failed to ingest FHIR bundle.');
  });

  // ── Detail expansion ────────────────────────────────────────

  it('toggles which resource detail panel is expanded', () => {
    const { component } = createFhir(makeUser('doctor'));

    component.toggleResource('res-1');
    expect(component.expandedId()).toBe('res-1');

    component.toggleResource('res-1');
    expect(component.expandedId()).toBeNull();

    component.toggleResource('res-2');
    expect(component.expandedId()).toBe('res-2');
  });
});
