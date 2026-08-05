/**
 * apps/web/src/app/pages/fhir/fhir-search.component.spec.ts
 *
 * Unit tests for FhirSearchComponent — the FHIR search + bundle ingest
 * form. Covers typed FhirSearchCriteria/FhirIngestPayload emission,
 * ingest-form required-field validation, the conditional ingestResult
 * reset effect, RBAC section gating, disabled buttons, and the
 * ingest-result message display.
 *
 * The component injects only FormBuilder (provided by its own
 * ReactiveFormsModule import), so TestBed needs no extra providers.
 */
import { TestBed } from '@angular/core/testing';
import { FhirSearchComponent } from './fhir-search.component';
import type { FhirSearchCriteria, FhirIngestPayload } from './fhir-search.component';

describe('FhirSearchComponent', () => {
  function createSearch() {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(FhirSearchComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  /** A fully-valid ingest form value. */
  const VALID_INGEST = {
    sourceSystem: 'epic',
    bundleJson: '{"resourceType":"Bundle","entry":[]}',
  };

  // ── Search emission ──────────────────────────────────────────

  it('emits typed search criteria on submit', () => {
    const { component } = createSearch();
    const emitSpy = spyOn(component.searchResources, 'emit');

    component.searchForm.setValue({ resourceType: 'Patient', search: 'pat-1' });
    component.onSearch();

    const expected: FhirSearchCriteria = { resourceType: 'Patient', search: 'pat-1' };
    expect(emitSpy).toHaveBeenCalledWith(expected);
  });

  it('emits empty-string criteria when the search form is blank', () => {
    const { component } = createSearch();
    const emitSpy = spyOn(component.searchResources, 'emit');

    // The search form has no required validators, so it is always valid.
    component.onSearch();

    const expected: FhirSearchCriteria = { resourceType: '', search: '' };
    expect(emitSpy).toHaveBeenCalledWith(expected);
  });

  // ── Ingest emission + validation ─────────────────────────────

  it('emits a typed ingest payload on valid submit', () => {
    const { component } = createSearch();
    const emitSpy = spyOn(component.ingestBundle, 'emit');

    component.ingestForm.setValue(VALID_INGEST);
    component.onIngest();

    const expected: FhirIngestPayload = {
      sourceSystem: 'epic',
      bundleJson: '{"resourceType":"Bundle","entry":[]}',
    };
    expect(emitSpy).toHaveBeenCalledWith(expected);
  });

  it('does not emit when the source system is missing', () => {
    const { component } = createSearch();
    const emitSpy = spyOn(component.ingestBundle, 'emit');

    component.ingestForm.setValue({ sourceSystem: '', bundleJson: '{"a":1}' });
    component.onIngest();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('does not emit when the bundle JSON is missing', () => {
    const { component } = createSearch();
    const emitSpy = spyOn(component.ingestBundle, 'emit');

    component.ingestForm.setValue({ sourceSystem: 'epic', bundleJson: '' });
    component.onIngest();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  // ── ingestResult reset effect ────────────────────────────────

  it('resets the ingest form once a successful ingest result is reported', async () => {
    const { fixture, component } = createSearch();
    component.ingestForm.setValue(VALID_INGEST);

    fixture.componentRef.setInput('ingestResult', 'Ingested: 1 valid, 0 invalid of 1');
    fixture.detectChanges();
    // The constructor's `effect()` (conditional form.reset) flushes on the
    // effect scheduler, so let it run before asserting the reset.
    await fixture.whenStable();

    expect(component.ingestForm.controls.sourceSystem.value).toBe('');
    expect(component.ingestForm.controls.bundleJson.value).toBe('');
  });

  it('does not reset the ingest form while no ingest result is set', async () => {
    const { fixture, component } = createSearch();
    component.ingestForm.setValue(VALID_INGEST);

    // ingestResult stays null → the effect's guard is false → no reset.
    fixture.componentRef.setInput('ingestResult', null);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.ingestForm.controls.sourceSystem.value).toBe('epic');
    expect(component.ingestForm.controls.bundleJson.value).toBe(
      '{"resourceType":"Bundle","entry":[]}',
    );
  });

  // ── Template wiring ──────────────────────────────────────────

  it('hides the search section when the user cannot search', () => {
    const { fixture } = createSearch();
    // Both inputs default to false → sections are hidden until enabled.
    fixture.componentRef.setInput('canIngest', true);
    fixture.componentRef.setInput('canSearch', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#resourceType')).toBeNull();
    expect(fixture.nativeElement.querySelector('#sourceSystem')).not.toBeNull();
  });

  it('hides the ingest section when the user cannot ingest', () => {
    const { fixture } = createSearch();
    fixture.componentRef.setInput('canSearch', true);
    fixture.componentRef.setInput('canIngest', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#sourceSystem')).toBeNull();
    expect(fixture.nativeElement.querySelector('#resourceType')).not.toBeNull();
  });

  it('disables the search button and shows Searching while loading', () => {
    const { fixture } = createSearch();
    fixture.componentRef.setInput('canSearch', true);
    fixture.componentRef.setInput('canIngest', true);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '.form-section:not(.ingest-section) button[type="submit"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Searching');
  });

  it('disables the ingest button and shows Ingesting while ingesting', () => {
    const { fixture } = createSearch();
    fixture.componentRef.setInput('canSearch', true);
    fixture.componentRef.setInput('canIngest', true);
    fixture.componentRef.setInput('ingesting', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '.ingest-section button[type="submit"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Ingesting');
  });

  it('renders the ingest result message when one is reported', () => {
    const { fixture } = createSearch();
    fixture.componentRef.setInput('canIngest', true);
    fixture.componentRef.setInput('ingestResult', 'Ingested: 1 valid, 0 invalid of 1');
    fixture.detectChanges();

    const message = fixture.nativeElement.querySelector('.ingest-result') as HTMLElement;
    expect(message.textContent).toContain('Ingested: 1 valid, 0 invalid of 1');
  });
});
