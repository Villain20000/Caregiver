/**
 * apps/web/src/app/pages/fhir/fhir-resource-list.component.ts
 *
 * Resource list component for the FHIR Resources page.
 *
 * Renders a card for each persisted FHIR resource. Clicking a card toggles
 * an inline detail panel powered by the resource detail component.
 */
import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FhirResourceResponse } from '../../services/fhir.service.js';
import { FhirResourceDetailComponent } from './fhir-resource-detail.component.js';

@Component({
  selector: 'app-fhir-resource-list',
  standalone: true,
  imports: [CommonModule, FhirResourceDetailComponent],
  template: `
    <div class="history-section">
      <h2>Resources</h2>

      @if (loading()) {
        <div class="loading">Loading resources...</div>
      }

      @if (!loading() && resources().length > 0) {
        <div class="resource-list">
          @for (resource of resources(); track resource.id) {
            <div class="resource-card" [class.expanded]="expandedId() === resource.id">
              <div class="resource-summary" (click)="toggle.emit(resource.id)">
                <div class="resource-meta">
                  <span class="resource-type">{{ resource.resourceType }}</span>
                  <span class="resource-status" [class]="resource.validationStatus">{{ resource.validationStatus }}</span>
                  <span class="resource-id">{{ resource.fhirId }}</span>
                </div>
                <span class="toggle-hint">
                  {{ expandedId() === resource.id ? 'Hide detail' : 'View detail' }}
                </span>
              </div>

              @if (expandedId() === resource.id) {
                <app-fhir-resource-detail [resource]="resource" />
              }
            </div>
          }
        </div>
      }

      @if (!loading() && resources().length === 0) {
        <div class="empty-state">No resources found.</div>
      }
    </div>
  `,
  styles: [`
    .history-section {
      margin-top: 1.5rem; padding: 1.5rem; background: white;
      border: 1px solid #e0e0e0; border-radius: 8px;
    }
    h2 { margin-top: 0; color: #333; font-size: 1.1rem; }
    .loading, .empty-state { text-align: center; color: #999; padding: 1rem; }
    .resource-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
    .resource-card {
      padding: 1rem; background: #f5f5f5; border-radius: 6px;
      border: 1px solid transparent; transition: border-color 0.2s;
    }
    .resource-card:hover { border-color: #1a237e; }
    .resource-card.expanded { border-color: #1a237e; }
    .resource-summary {
      display: flex; justify-content: space-between; align-items: center;
      gap: 0.75rem; flex-wrap: wrap; cursor: pointer;
    }
    .resource-meta { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .resource-type { font-weight: 600; color: #1a237e; text-transform: uppercase; font-size: 0.75rem; }
    .resource-id { font-size: 0.8rem; color: #666; font-family: monospace; }
    .resource-status {
      padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.7rem;
      text-transform: uppercase; font-weight: 600;
    }
    .resource-status.valid { background: #e8f5e9; color: #2e7d32; }
    .resource-status.invalid { background: #ffebee; color: #c62828; }
    .toggle-hint {
      font-size: 0.75rem; color: #1a237e; font-weight: 500;
      white-space: nowrap;
    }
  `],
})
export class FhirResourceListComponent {
  /** Resources to render. */
  readonly resources = input.required<FhirResourceResponse[]>();
  /** True while the parent is loading data. */
  readonly loading = input<boolean>(false);
  /** Id of the resource whose detail panel is currently open. */
  readonly expandedId = input<string | null>(null);
  /** Emits the id of the resource that should be toggled. */
  readonly toggle = output<string>();
}
