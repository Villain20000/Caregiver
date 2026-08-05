/**
 * apps/web/src/app/services/fhir.service.spec.ts
 *
 * Unit tests for FhirService — the FHIR search/ingest API client.
 *
 * Follows the auth.service.spec.ts pattern: HttpClient is replaced with a
 * jasmine SpyObj, and each method's HTTP verb, URL, and request body are
 * asserted directly. Search params are built conditionally, so specs cover
 * both the empty and fully-populated param maps.
 */
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { FhirService, type FhirResourceResponse, type IngestSummary } from './fhir.service';

describe('FhirService', () => {
  let httpSpy: jasmine.SpyObj<Pick<HttpClient, 'get' | 'post'>>;

  const mockResource: FhirResourceResponse = {
    id: 'res-1',
    resourceType: 'Patient',
    fhirId: 'pat-1',
    resource: { resourceType: 'Patient', id: 'pat-1' },
    validationStatus: 'valid',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockIngest: IngestSummary = {
    valid: true,
    totalResources: 1,
    validResources: 1,
    invalidResources: 0,
  };

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['get', 'post']);
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpy }],
    });
  });

  function createService(): FhirService {
    return TestBed.inject(FhirService);
  }

  it('searches resources without query params when no filters are given', () => {
    httpSpy.get.and.returnValue(of([mockResource]));
    const service = createService();

    let received: FhirResourceResponse[] = [];
    service.searchResources().subscribe((resources) => (received = resources));

    expect(httpSpy.get).toHaveBeenCalledWith('/api/fhir/resources', { params: {} });
    expect(received.length).toBe(1);
  });

  it('builds query params for every search filter', () => {
    httpSpy.get.and.returnValue(of([mockResource]));
    const service = createService();

    service.searchResources('Patient', 'pat-1', 10, 20).subscribe();

    expect(httpSpy.get).toHaveBeenCalledWith('/api/fhir/resources', {
      params: { resourceType: 'Patient', search: 'pat-1', limit: '10', offset: '20' },
    });
  });

  it('omits empty search filters from the query params', () => {
    httpSpy.get.and.returnValue(of([mockResource]));
    const service = createService();

    service.searchResources(undefined, '', undefined, 5).subscribe();

    expect(httpSpy.get).toHaveBeenCalledWith('/api/fhir/resources', {
      params: { offset: '5' },
    });
  });

  it('retrieves a single resource by type and id', () => {
    httpSpy.get.and.returnValue(of(mockResource));
    const service = createService();

    let received: FhirResourceResponse | undefined;
    service.getResource('Observation', 'obs-1').subscribe((resource) => (received = resource));

    expect(httpSpy.get).toHaveBeenCalledWith('/api/fhir/Observation/obs-1');
    expect(received?.fhirId).toBe('pat-1');
  });

  it('ingests a bundle with source system and submitter', () => {
    httpSpy.post.and.returnValue(of(mockIngest));
    const service = createService();

    const bundle = { resourceType: 'Bundle', entry: [] };
    let received: IngestSummary | undefined;
    service.ingestBundle(bundle, 'epic', 'user-1').subscribe((summary) => (received = summary));

    expect(httpSpy.post).toHaveBeenCalledWith('/api/fhir/ingest', {
      bundle,
      sourceSystem: 'epic',
      submittedBy: 'user-1',
    });
    expect(received?.validResources).toBe(1);
  });

  it('ingests a bundle without a submitter', () => {
    httpSpy.post.and.returnValue(of(mockIngest));
    const service = createService();

    service.ingestBundle({ resourceType: 'Bundle' }, 'cerner').subscribe();

    expect(httpSpy.post).toHaveBeenCalledWith('/api/fhir/ingest', {
      bundle: { resourceType: 'Bundle' },
      sourceSystem: 'cerner',
      submittedBy: undefined,
    });
  });
});
