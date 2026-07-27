/**
 * apps/web/src/app/pages/fhir/fhir-search.component.ts
 *
 * Search / ingest component for the FHIR Resources page.
 *
 * Renders the search filter form (resource type + id) and the FHIR bundle
 * ingestion form. Emits user actions to the parent page for data fetching.
 */
import { Component, effect, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

/** Search criteria emitted by the FHIR search form. */
export interface FhirSearchCriteria {
  /** FHIR resource type filter (empty = all). */
  resourceType: string;
  /** Free-text id search. */
  search: string;
}

/** Ingest payload emitted by the FHIR ingest form. */
export interface FhirIngestPayload {
  /** Identifier for the source system that produced the bundle. */
  sourceSystem: string;
  /** Raw FHIR bundle JSON. */
  bundleJson: string;
}

@Component({
  selector: 'app-fhir-search',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="search-panel">
      @if (canSearch()) {
        <div class="form-section">
          <h2>Search Resources</h2>
          <form [formGroup]="searchForm" (ngSubmit)="onSearch()">
            <div class="form-row">
              <div class="form-field">
                <label for="resourceType">Resource Type</label>
                <select id="resourceType" formControlName="resourceType">
                  <option value="">All</option>
                  <option value="Patient">Patient</option>
                  <option value="Observation">Observation</option>
                  <option value="Encounter">Encounter</option>
                  <option value="Appointment">Appointment</option>
                  <option value="DiagnosticReport">DiagnosticReport</option>
                  <option value="MedicationRequest">MedicationRequest</option>
                  <option value="ServiceRequest">ServiceRequest</option>
                  <option value="Claim">Claim</option>
                  <option value="ExplanationOfBenefit">ExplanationOfBenefit</option>
                </select>
              </div>
              <div class="form-field">
                <label for="search">Search ID</label>
                <input id="search" type="text" formControlName="search" placeholder="FHIR id" />
              </div>
            </div>
            <button type="submit" [disabled]="loading()" class="primary-btn">
              {{ loading() ? 'Searching...' : 'Search' }}
            </button>
          </form>
        </div>
      }

      @if (canIngest()) {
        <div class="form-section ingest-section">
          <h2>Ingest FHIR Bundle</h2>
          <form [formGroup]="ingestForm" (ngSubmit)="onIngest()">
            <div class="form-field">
              <label for="sourceSystem">Source System</label>
              <input id="sourceSystem" type="text" formControlName="sourceSystem" placeholder="e.g. epic, cerner" />
            </div>
            <div class="form-field">
              <label for="bundleJson">FHIR Bundle JSON</label>
              <textarea id="bundleJson" formControlName="bundleJson" rows="6" placeholder="Paste a FHIR Bundle JSON..."></textarea>
            </div>
            <button type="submit" [disabled]="ingesting()" class="primary-btn">
              {{ ingesting() ? 'Ingesting...' : 'Ingest Bundle' }}
            </button>
            @if (ingestResult()) {
              <div class="ingest-result">{{ ingestResult() }}</div>
            }
          </form>
        </div>
      }
    </div>
  `,
  styles: [`
    .search-panel { display: grid; gap: 1.5rem; }
    .form-section {
      padding: 1.5rem; background: white; border: 1px solid #e0e0e0;
      border-radius: 8px;
    }
    h2 { margin-top: 0; color: #333; font-size: 1.1rem; }
    .form-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .form-field { flex: 1; }
    .form-field label { display: block; margin-bottom: 0.3rem; font-size: 0.8rem; font-weight: 500; }
    .form-field input, .form-field textarea, .form-field select {
      width: 100%; padding: 0.5rem; border: 1px solid #ddd;
      border-radius: 4px; box-sizing: border-box; font-family: inherit;
    }
    .primary-btn {
      padding: 0.6rem 1.5rem; background: #1a237e; color: white;
      border: none; border-radius: 4px; cursor: pointer;
    }
    .primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .ingest-result {
      margin-top: 0.75rem; padding: 0.5rem; background: #e8f5e9;
      border-radius: 4px; color: #2e7d32; font-size: 0.875rem;
    }
    .ingest-section { border-left: 4px solid #1a237e; }
  `],
})
export class FhirSearchComponent {
  private readonly fb = inject(FormBuilder);

  /** Whether the current user may search resources. */
  readonly canSearch = input<boolean>(false);
  /** Whether the current user may ingest FHIR bundles. */
  readonly canIngest = input<boolean>(false);
  /** True while a search request is in flight. */
  readonly loading = input<boolean>(false);
  /** True while a bundle ingestion is in flight. */
  readonly ingesting = input<boolean>(false);
  /** Optional result message to display after a successful ingest. */
  readonly ingestResult = input<string | null>(null);

  /** Emitted when the user submits a new search. */
  readonly search = output<FhirSearchCriteria>();
  /** Emitted when the user submits a bundle for ingestion. */
  readonly ingest = output<FhirIngestPayload>();

  /** Reactive form for resource search filters. */
  readonly searchForm = this.fb.nonNullable.group({
    resourceType: [''],
    search: [''],
  });

  /** Reactive form for FHIR bundle ingestion. */
  readonly ingestForm = this.fb.nonNullable.group({
    sourceSystem: ['', [Validators.required]],
    bundleJson: ['', [Validators.required]],
  });

  constructor() {
    // Reset the ingest form once the parent reports a successful ingestion.
    effect(() => {
      if (this.ingestResult()) {
        this.ingestForm.reset();
      }
    });
  }

  /** Validate and emit the current search criteria. */
  onSearch(): void {
    if (this.searchForm.invalid) return;
    const value = this.searchForm.getRawValue();
    this.search.emit({
      resourceType: value.resourceType,
      search: value.search,
    });
  }

  /** Validate and emit the current ingest payload. The parent resets the form on success. */
  onIngest(): void {
    if (this.ingestForm.invalid) return;
    const value = this.ingestForm.getRawValue();
    this.ingest.emit({
      sourceSystem: value.sourceSystem,
      bundleJson: value.bundleJson,
    });
  }
}
