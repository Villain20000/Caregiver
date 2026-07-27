/**
 * apps/web/src/app/pages/fhir/fhir-resource-detail.component.ts
 *
 * Resource detail viewer for the FHIR Resources page.
 *
 * Displays a readable summary of a persisted FHIR resource along with a
 * collapsible, formatted JSON payload. Includes a copy-to-clipboard action.
 */
import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FhirResourceResponse } from '../../services/fhir.service.js';

@Component({
  selector: 'app-fhir-resource-detail',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="detail-panel">
      <div class="detail-header">
        <div class="detail-meta">
          <span class="detail-type">{{ resource().resourceType }}</span>
          <span class="detail-id">{{ resource().fhirId }}</span>
          <span class="detail-status" [class]="resource().validationStatus">{{ resource().validationStatus }}</span>
        </div>
        <div class="detail-actions">
          <button (click)="copyJson()" class="action-btn" type="button">
            {{ copied() ? 'Copied!' : 'Copy JSON' }}
          </button>
          <button (click)="toggleExpanded()" class="action-btn" type="button">
            {{ expanded() ? 'Hide JSON' : 'View JSON' }}
          </button>
        </div>
      </div>

      <div class="detail-summary">
        <p><strong>Internal ID:</strong> {{ resource().id }}</p>
        <p><strong>Created:</strong> {{ resource().createdAt | date:'medium' }}</p>
        <p><strong>Updated:</strong> {{ resource().updatedAt | date:'medium' }}</p>
      </div>

      @if (expanded()) {
        <pre class="json-viewer">{{ prettyJson() }}</pre>
      }
    </div>
  `,
  styles: [`
    .detail-panel {
      padding: 1rem; background: #f5f5f5; border-radius: 6px;
      border: 1px solid #e0e0e0;
    }
    .detail-header {
      display: flex; justify-content: space-between; align-items: center;
      gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem;
    }
    .detail-meta { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .detail-type { font-weight: 600; color: #1a237e; text-transform: uppercase; font-size: 0.75rem; }
    .detail-id { font-size: 0.8rem; color: #666; font-family: monospace; }
    .detail-status {
      padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.7rem;
      text-transform: uppercase; font-weight: 600;
    }
    .detail-status.valid { background: #e8f5e9; color: #2e7d32; }
    .detail-status.invalid { background: #ffebee; color: #c62828; }
    .detail-actions { display: flex; gap: 0.5rem; }
    .action-btn {
      padding: 0.3rem 0.7rem; border: 1px solid #1a237e; background: white;
      color: #1a237e; border-radius: 4px; cursor: pointer; font-size: 0.8rem;
    }
    .detail-summary p { margin: 0.25rem 0; font-size: 0.875rem; }
    .json-viewer {
      margin-top: 0.75rem; padding: 0.75rem; background: #263238;
      color: #aed581; border-radius: 4px; overflow-x: auto;
      font-size: 0.75rem; white-space: pre-wrap;
    }
  `],
})
export class FhirResourceDetailComponent {
  /** The resource to display. */
  readonly resource = input.required<FhirResourceResponse>();

  /** Whether the raw JSON block is currently visible. */
  readonly expanded = signal(true);

  /** True after the user has copied the JSON to the clipboard. */
  readonly copied = signal(false);

  /** Pretty-printed JSON of the raw resource payload. */
  readonly prettyJson = computed(() => JSON.stringify(this.resource().resource, null, 2));

  /** Toggle the raw JSON block open/closed. */
  toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  /** Copy the pretty-printed JSON to the clipboard and show feedback. */
  async copyJson(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.prettyJson());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // clipboard access failed; ignore silently
    }
  }
}
