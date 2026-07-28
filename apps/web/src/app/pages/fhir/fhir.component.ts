/**
 * apps/web/src/app/pages/fhir/fhir.component.ts
 *
 * FHIR Resources page.
 *
 * Orchestrates the FHIR search, resource list, and resource detail
 * components. Handles RBAC, data loading, ingestion, and selection state.
 */
import { Component, inject, signal, computed, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service.js';
import {
  FhirService,
  type FhirResourceResponse,
  type IngestSummary,
} from '../../services/fhir.service.js';
import {
  FhirSearchComponent,
  type FhirSearchCriteria,
  type FhirIngestPayload,
} from './fhir-search.component.js';
import { FhirResourceListComponent } from './fhir-resource-list.component.js';

@Component({
  selector: 'app-fhir',
  standalone: true,
  imports: [CommonModule, FhirSearchComponent, FhirResourceListComponent],
  template: `
    <div class="page">
      <h1>FHIR Resources</h1>
      <p class="page-subtitle">Browse, search, and ingest FHIR R4 resources.</p>

      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <app-fhir-search
        [canSearch]="canSearch()"
        [canIngest]="canIngest()"
        [loading]="loading()"
        [ingesting]="ingesting()"
        [ingestResult]="ingestResult()"
        (searchResources)="onSearch($event)"
        (ingestBundle)="onIngest($event)"
      />

      <app-fhir-resource-list
        [resources]="resources()"
        [loading]="loading()"
        [expandedId]="expandedId()"
        (toggleResource)="toggleResource($event)"
      />
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 1200px;
        margin: 0 auto;
      }
      h1 {
        color: #1a237e;
        margin-bottom: 0.25rem;
      }
      .page-subtitle {
        color: #666;
        margin-top: 0;
      }
      .error-banner {
        margin-top: 1rem;
        padding: 0.75rem;
        background: #ffebee;
        border: 1px solid #ef9a9a;
        border-radius: 4px;
        color: #c62828;
        font-size: 0.875rem;
      }
    `,
  ],
})
export class FhirComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly fhirService = inject(FhirService);

  /** Persisted FHIR resources returned by the latest search. */
  readonly resources = signal<FhirResourceResponse[]>([]);
  /** True while resources are being fetched. */
  readonly loading = signal(true);
  /** True while a bundle is being ingested. */
  readonly ingesting = signal(false);
  /** Latest user-facing error message, if any. */
  readonly error = signal<string | null>(null);
  /** Short result message shown after a successful ingestion. */
  readonly ingestResult = signal<string | null>(null);
  /** Id of the resource whose detail panel is open. */
  readonly expandedId = signal<string | null>(null);

  /** Whether the current role may ingest bundles. */
  readonly canIngest = computed(() => {
    const role = this.authService.userRole();
    return role === 'admin' || role === 'medical_director';
  });

  /** Whether the current role may search resources. */
  readonly canSearch = computed(() => {
    const role = this.authService.userRole();
    return role !== null && role !== 'patient';
  });

  ngOnInit(): void {
    this.loadResources();
  }

  /**
   * Fetch the full list of resources.
   *
   * Called on page load and after a successful ingestion.
   */
  private async loadResources(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const resources = await this.fhirService.searchResources().toPromise();
      this.resources.set(resources ?? []);
    } catch {
      this.error.set('Failed to load FHIR resources.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handle a search request from the search component.
   *
   * @param criteria - Search filters.
   */
  async onSearch(criteria: FhirSearchCriteria): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const resources = await this.fhirService
        .searchResources(criteria.resourceType || undefined, criteria.search || undefined)
        .toPromise();
      this.resources.set(resources ?? []);
      this.expandedId.set(null);
    } catch {
      this.error.set('Failed to search FHIR resources.');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Handle an ingest request from the search component.
   *
   * @param payload - The ingest payload containing the bundle and source system.
   */
  async onIngest(payload: FhirIngestPayload): Promise<void> {
    this.ingesting.set(true);
    this.error.set(null);
    this.ingestResult.set(null);
    try {
      const bundle = JSON.parse(payload.bundleJson) as unknown;
      const result = await this.fhirService.ingestBundle(bundle, payload.sourceSystem).toPromise();
      this.ingestResult.set(this.formatIngestResult(result));
      await this.loadResources();
    } catch {
      this.error.set('Failed to ingest FHIR bundle.');
    } finally {
      this.ingesting.set(false);
    }
  }

  /**
   * Toggle which resource's detail panel is expanded.
   *
   * @param id - Resource id to toggle.
   */
  toggleResource(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  /** Format the ingest summary into a short human-readable string. */
  private formatIngestResult(result: IngestSummary | undefined): string {
    if (!result) return 'Ingestion complete.';
    return `Ingested: ${result.validResources} valid, ${result.invalidResources} invalid of ${result.totalResources}`;
  }
}
