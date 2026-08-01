/**
 * apps/web/src/app/pages/lab-results.component.ts
 *
 * Lab Results Viewer — LOINC-coded results with normal-range highlighting.
 *
 * Features:
 *   - Fetches FHIR Observation resources from the fhir_resources table
 *   - Parses LOINC codes, values, reference ranges, and interpretation flags
 *   - Color-coded table: green (normal), red (abnormal high), orange (abnormal low),
 *     purple (critical), gray (unavailable)
 *   - Detail panel for each lab result showing full FHIR Observation data
 *   - Patient filter, search by test name, filter by flag status
 *   - Summary stats: total results, abnormal count, critical count
 *   - Dark-mode aware (uses CSS custom properties)
 *
 * FHIR Observation resource structure (relevant fields):
 *   resourceType: 'Observation'
 *   status: 'final' | 'amended' | 'corrected' | 'cancelled' | ...
 *   code: CodeableConcept { coding: [{ system: 'http://loinc.org', code: '...', display: '...' }], text: '...' }
 *   valueQuantity: { value: number, unit: '...', system: '...', code: '...' }
 *   referenceRange: [{ low: { value: number }, high: { value: number }, type: { text: 'normal' }, text: '...' }]
 *   interpretation: [{ coding: [{ code: 'N' | 'H' | 'L' | 'HH' | 'LL' | ... }] }]
 *   effectiveDateTime: '2024-01-15T08:30:00Z'
 *   subject: { reference: 'Patient/...' }
 */
import { Component, computed, inject, signal, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service.js';
import type { FhirResourceResponse } from '../services/fhir.service.js';

// ── Types ────────────────────────────────────────────────────────────────
interface LabResult {
  id: string;
  fhirId: string;
  patientId: string;
  status: string;
  /** LOINC code (e.g. "8867-4"). */
  loinc: string;
  /** Human-readable test name. */
  testName: string;
  /** Numeric value from valueQuantity. */
  value: number | null;
  /** Value unit (e.g. "mg/dL", "x10^3/uL"). */
  unit: string;
  /** Low end of normal reference range. */
  refLow: number | null;
  /** High end of normal reference range. */
  refHigh: number | null;
  /** Reference range text (e.g. "4.0 - 10.0 x10^3/uL"). */
  refText: string;
  /** Interpretation flag code: N (normal), H (high), L (low), HH (crit high), LL (crit low), etc. */
  flag: string;
  /** When the observation was made. */
  effectiveDate: string | null;
  /** Raw FHIR resource JSON. */
  resource: unknown;
}

interface ParsedFlag {
  label: string;
  cssClass: string;
}

// ── LOINC-based knowledge for display names (fallback if FHIR display missing) ──
const LOINC_NAMES: Record<string, string> = {
  '8867-4': 'Heart rate',
  '8480-6': 'Systolic blood pressure',
  '8462-4': 'Diastolic blood pressure',
  '8310-5': 'Body temperature',
  '2708-6': 'Oxygen saturation',
  '9279-1': 'Respiratory rate',
  '718-7': 'Hemoglobin',
  '787-2': 'MCV',
  '4544-3': 'Hematocrit',
  '6690-2': 'Leukocytes (WBC)',
  '777-3': 'Platelets',
  '6298-5': 'Potassium',
  '2951-2': 'Sodium',
  '2075-0': 'Chloride',
  '2028-9': 'Carbon dioxide (CO2)',
  '3094-0': 'BUN',
  '38483-4': 'Creatinine',
  '2345-7': 'Glucose',
  '2093-3': 'Total cholesterol',
  '2085-9': 'HDL cholesterol',
  '2089-1': 'LDL cholesterol',
  '2571-8': 'Triglycerides',
  '1751-7': 'Albumin',
  '3068-4': 'ALT (SGPT)',
  '1920-8': 'AST (SGOT)',
  '2324-2': 'Gamma GT',
  '1975-1': 'Bilirubin, total',
  '14631-6': 'Bilirubin, direct',
  '6768-6': 'Alkaline phosphatase',
  '33914-3': 'Estimated GFR',
  '4548-4': 'INR',
  '6301-6': 'INR (PT)',
  '5902-2': 'Prothrombin time',
  '35659-2': 'BMI',
};

// ── Interpretation flag mapping ───────────────────────────────────────────
const FLAG_MAP: Record<string, ParsedFlag> = {
  N: { label: 'Normal', cssClass: 'flag-normal' },
  H: { label: 'High', cssClass: 'flag-high' },
  L: { label: 'Low', cssClass: 'flag-low' },
  HH: { label: 'Critically High', cssClass: 'flag-critical' },
  LL: { label: 'Critically Low', cssClass: 'flag-critical' },
  HU: { label: 'High (significant)', cssClass: 'flag-high' },
  LU: { label: 'Low (significant)', cssClass: 'flag-low' },
  A: { label: 'Abnormal', cssClass: 'flag-abnormal' },
  AA: { label: 'Critically Abnormal', cssClass: 'flag-critical' },
  D: { label: 'Significant change', cssClass: 'flag-abnormal' },
  null: { label: '—', cssClass: '' },
};
const DEFAULT_FLAG: ParsedFlag = { label: '—', cssClass: '' };

function getFlag(code: string | undefined): ParsedFlag {
  if (!code) return DEFAULT_FLAG;
  return FLAG_MAP[code] ?? { label: code, cssClass: 'flag-abnormal' };
}

// ── Utility: extract values from FHIR Observation JSON ──────────────────
function parseObservation(r: unknown): LabResult | null {
  const fhir = r as Record<string, unknown> | undefined;
  if (!fhir || fhir.resourceType !== 'Observation') return null;

  // ID
  const id = (fhir.id as string | undefined) ?? '';

  // Patient
  const subject = fhir.subject as Record<string, unknown> | undefined;
  const patientRef = (subject?.reference as string | undefined) ?? '';
  const patientId = patientRef.replace('Patient/', '');

  // Status
  const status = (fhir.status as string | undefined) ?? 'unknown';

  // Code (LOINC)
  const code = fhir.code as Record<string, unknown> | undefined;
  const coding = (code?.coding as Array<Record<string, unknown>> | undefined) ?? [];
  const loincCoding = coding.find((c) => c.system === 'http://loinc.org');
  const loinc = (loincCoding?.code as string | undefined) ?? '';
  const displayFromCoding = (loincCoding?.display as string | undefined) ?? '';
  const text = (code?.text as string | undefined) ?? '';
  const testName = displayFromCoding || text || LOINC_NAMES[loinc] || loinc || 'Unknown';

  // Value
  const valueQty = fhir.valueQuantity as Record<string, unknown> | undefined;
  const value = (valueQty?.value as number | undefined) ?? null;
  const unit = (valueQty?.unit as string | undefined) ?? '';

  // Reference range
  const refRanges = (fhir.referenceRange as Array<Record<string, unknown>> | undefined) ?? [];
  const normalRange = refRanges.find((r) => {
    const type = r.type as Record<string, unknown> | undefined;
    const text = type?.text as string | undefined;
    return !text || text.toLowerCase() === 'normal' || text.toLowerCase() === 'reference range';
  });

  let refLow: number | null = null;
  let refHigh: number | null = null;
  let refText = '';
  if (normalRange) {
    const low = normalRange.low as Record<string, unknown> | undefined;
    const high = normalRange.high as Record<string, unknown> | undefined;
    refLow = (low?.value as number | undefined) ?? null;
    refHigh = (high?.value as number | undefined) ?? null;
    refText = (normalRange.text as string | undefined) ?? '';
    if (!refText && refLow !== null && refHigh !== null) {
      refText = `${refLow} – ${refHigh}`;
    } else if (!refText && refLow !== null) {
      refText = `≥ ${refLow}`;
    } else if (!refText && refHigh !== null) {
      refText = `≤ ${refHigh}`;
    }
  } else if (refRanges.length > 0) {
    // Fall back to first range
    const low = refRanges[0]?.low as Record<string, unknown> | undefined;
    const high = refRanges[0]?.high as Record<string, unknown> | undefined;
    refLow = (low?.value as number | undefined) ?? null;
    refHigh = (high?.value as number | undefined) ?? null;
  }

  // Interpretation flag
  const interpretations = (fhir.interpretation as Array<Record<string, unknown>> | undefined) ?? [];
  let flagCode: string | undefined;
  if (interpretations.length > 0) {
    const interpCoding =
      (interpretations[0]?.coding as Array<Record<string, unknown>> | undefined) ?? [];
    flagCode = interpCoding[0]?.code as string | undefined;
  }
  // Fallback: calculate from value vs reference range
  if (!flagCode && value !== null) {
    if (refHigh !== null && value > refHigh) flagCode = 'H';
    else if (refLow !== null && value < refLow) flagCode = 'L';
    else flagCode = 'N';
  }

  // Effective date
  const effectiveDateTime = (fhir.effectiveDateTime as string | undefined) ?? null;

  return {
    id,
    fhirId: id,
    patientId,
    status,
    loinc,
    testName,
    value,
    unit,
    refLow,
    refHigh,
    refText,
    flag: flagCode ?? '',
    effectiveDate: effectiveDateTime,
    resource: fhir,
  };
}

@Component({
  selector: 'app-lab-results',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page page-wide">
      <!-- ═══ PAGE HEADER ═══ -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Lab Results</h1>
          <p class="page-subtitle">
            LOINC-coded laboratory results with reference ranges and flag indicators.
          </p>
        </div>
        <div class="header-actions">
          @if (!loading() && error() === null) {
            <button class="secondary-btn" (click)="loadResults()">🔄 Refresh</button>
          }
        </div>
      </div>

      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <!-- ═══ FILTERS ═══ -->
      <div class="filter-bar">
        <div class="filter-field">
          <input
            type="text"
            [formControl]="searchControl"
            placeholder="Search test name or LOINC code..."
            class="filter-input"
          />
        </div>
        <div class="filter-field">
          <select [formControl]="flagFilterControl" class="filter-select">
            <option value="">All flags</option>
            <option value="normal">Normal</option>
            <option value="abnormal">Abnormal</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div class="filter-field">
          <input
            type="text"
            [formControl]="patientFilterControl"
            placeholder="Filter by Patient ID..."
            class="filter-input"
          />
        </div>
        <div class="summary-stats">
          <span class="stat-chip total">📊 {{ results().length }}</span>
          <span class="stat-chip abnormal">⚠️ {{ abnormalCount() }}</span>
          <span class="stat-chip critical">🔴 {{ criticalCount() }}</span>
        </div>
      </div>

      <!-- ═══ LOADING ═══ -->
      @if (loading()) {
        <div class="loading"><span class="spinner"></span> Loading lab results...</div>
      }

      <!-- ═══ TABLE ═══ -->
      @if (!loading() && filteredResults().length > 0) {
        <div class="table-container">
          <table class="lab-table">
            <thead>
              <tr>
                <th>Test Name</th>
                <th>LOINC</th>
                <th>Result</th>
                <th>Ref Range</th>
                <th>Flag</th>
                <th>Date</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              @for (result of filteredResults(); track result.fhirId) {
                <tr
                  class="lab-row"
                  [class.expanded]="expandedId() === result.fhirId"
                  (click)="toggleDetail(result.fhirId)"
                >
                  <td class="test-name">
                    <span class="test-name-text">{{ result.testName }}</span>
                    @if (result.loinc) {
                      <span class="loinc-code">{{ result.loinc }}</span>
                    }
                  </td>
                  <td class="loinc-cell">
                    <code>{{ result.loinc }}</code>
                  </td>
                  <td class="value-cell">
                    @if (result.value !== null) {
                      <span class="result-value">{{
                        formatValue(result.value, result.loinc)
                      }}</span>
                      @if (result.unit) {
                        <span class="result-unit">{{ result.unit }}</span>
                      }
                    } @else {
                      <span class="text-muted">—</span>
                    }
                  </td>
                  <td class="ref-cell">
                    @if (result.refText) {
                      {{ result.refText }}
                    } @else if (result.refLow !== null || result.refHigh !== null) {
                      {{ result.refLow ?? '—' }} – {{ result.refHigh ?? '—' }}
                    } @else {
                      <span class="text-muted">—</span>
                    }
                  </td>
                  <td class="flag-cell">
                    <span class="flag-badge" [class]="getFlagCss(result.flag)">
                      {{ getFlagLabel(result.flag) }}
                    </span>
                  </td>
                  <td class="date-cell">
                    @if (result.effectiveDate) {
                      {{ result.effectiveDate | date: 'MMM d, yyyy' }}
                    } @else {
                      <span class="text-muted">—</span>
                    }
                  </td>
                  <td class="detail-toggle">
                    <button
                      class="icon-btn-sm"
                      [attr.aria-label]="expandedId() === result.fhirId ? 'Collapse' : 'Expand'"
                    >
                      {{ expandedId() === result.fhirId ? '▲' : '▼' }}
                    </button>
                  </td>
                </tr>
                <!-- Detail row -->
                @if (expandedId() === result.fhirId) {
                  <tr class="detail-row">
                    <td colspan="7">
                      <div class="detail-panel">
                        <div class="detail-grid">
                          <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span class="detail-value">
                              <span class="status-badge" [class]="result.status">
                                {{ result.status }}
                              </span>
                            </span>
                          </div>
                          <div class="detail-item">
                            <span class="detail-label">Patient</span>
                            <span class="detail-value mono">{{ result.patientId || '—' }}</span>
                          </div>
                          <div class="detail-item">
                            <span class="detail-label">LOINC</span>
                            <span class="detail-value mono">{{ result.loinc || '—' }}</span>
                          </div>
                          @if (result.unit) {
                            <div class="detail-item">
                              <span class="detail-label">Unit</span>
                              <span class="detail-value">{{ result.unit }}</span>
                            </div>
                          }
                          @if (result.refLow !== null) {
                            <div class="detail-item">
                              <span class="detail-label">Ref Low</span>
                              <span class="detail-value"
                                >{{ result.refLow }} {{ result.unit }}</span
                              >
                            </div>
                          }
                          @if (result.refHigh !== null) {
                            <div class="detail-item">
                              <span class="detail-label">Ref High</span>
                              <span class="detail-value"
                                >{{ result.refHigh }} {{ result.unit }}</span
                              >
                            </div>
                          }
                          <div class="detail-item">
                            <span class="detail-label">Interpretation</span>
                            <span class="detail-value">
                              <span class="flag-badge" [class]="getFlagCss(result.flag)">
                                {{ getFlagLabel(result.flag) }}
                              </span>
                            </span>
                          </div>
                          @if (result.effectiveDate) {
                            <div class="detail-item">
                              <span class="detail-label">Collected</span>
                              <span class="detail-value">{{
                                result.effectiveDate | date: 'medium'
                              }}</span>
                            </div>
                          }
                        </div>
                        <button
                          class="action-btn"
                          (click)="$event.stopPropagation(); copyResultJson(result)"
                        >
                          📋 Copy JSON
                        </button>
                        @if (copiedId() === result.fhirId) {
                          <span class="copied-msg">Copied!</span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }

      <!-- ═══ EMPTY ═══ -->
      @if (!loading() && fetched() && filteredResults().length === 0) {
        <div class="empty-state">
          <div class="empty-state-icon">🔬</div>
          <p class="empty-state-text">
            {{
              results().length === 0
                ? 'No lab results found. Ingest FHIR Observation resources to view them here.'
                : 'No results match your filters.'
            }}
          </p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      /* ═══ HEADER ═══ */
      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      /* ═══ FILTER BAR ═══ */
      .filter-bar {
        display: flex;
        gap: var(--space-3);
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: var(--space-4);
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
      }
      .filter-field {
        flex: 1;
        min-width: 160px;
      }
      .filter-input,
      .filter-select {
        width: 100%;
        padding: 0.45rem 0.65rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        background: var(--color-white);
        font-family: inherit;
      }
      .filter-input:focus,
      .filter-select:focus {
        border-color: var(--color-primary);
        outline: none;
        box-shadow: 0 0 0 3px rgba(26, 35, 126, 0.1);
      }
      .summary-stats {
        display: flex;
        gap: var(--space-2);
        align-items: center;
        flex-shrink: 0;
      }
      .stat-chip {
        padding: 0.2rem 0.5rem;
        border-radius: var(--radius-full);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
      }
      .stat-chip.total {
        background: var(--color-primary-bg);
        color: var(--color-primary);
      }
      .stat-chip.abnormal {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
      .stat-chip.critical {
        background: var(--color-error-bg);
        color: var(--color-error);
      }

      /* ═══ TABLE ═══ */
      .table-container {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      .lab-table {
        width: 100%;
        border-collapse: collapse;
      }
      .lab-table th {
        padding: 0.6rem 0.75rem;
        text-align: left;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
        background: var(--color-primary-bg);
        border-bottom: 2px solid var(--color-border);
        white-space: nowrap;
      }
      .lab-row td {
        padding: 0.6rem 0.75rem;
        font-size: var(--text-sm);
        border-bottom: 1px solid var(--color-border-light);
        transition: background var(--transition-fast);
      }
      .lab-row:hover td {
        background: var(--color-fill-hover);
      }
      .lab-row.expanded td {
        background: var(--color-primary-surface);
        border-bottom-color: transparent;
      }

      /* Test name column */
      .test-name {
        min-width: 180px;
      }
      .test-name-text {
        font-weight: var(--font-medium);
        color: var(--color-text-primary);
        display: block;
      }
      .loinc-code {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        font-family: var(--font-mono);
      }
      .loinc-cell code {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        background: var(--color-fill-hover);
        padding: 0.1rem 0.3rem;
        border-radius: var(--radius-sm);
      }

      /* Value column */
      .value-cell {
        white-space: nowrap;
      }
      .result-value {
        font-weight: var(--font-semibold);
        font-size: var(--text-base);
        color: var(--color-text-primary);
      }
      .result-unit {
        margin-left: 0.3rem;
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      /* Reference range column */
      .ref-cell {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }

      /* Flag column */
      .flag-cell {
        white-space: nowrap;
      }
      .flag-badge {
        display: inline-block;
        padding: 0.15rem 0.5rem;
        border-radius: var(--radius-full);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      .flag-normal {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .flag-high,
      .flag-abnormal {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
      .flag-low {
        background: #fff8e1;
        color: #f57f17;
      }
      .flag-critical {
        background: var(--color-error-bg);
        color: var(--color-error);
      }

      /* Date column */
      .date-cell {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }

      /* Detail toggle */
      .detail-toggle {
        text-align: center;
        width: 40px;
      }
      .icon-btn-sm {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        background: transparent;
        cursor: pointer;
        font-size: 0.7rem;
        transition: background var(--transition-fast);
      }
      .icon-btn-sm:hover {
        background: var(--color-fill-hover);
      }

      /* Detail row */
      .detail-row td {
        padding: 0;
        border-bottom: 1px solid var(--color-border);
      }
      .detail-panel {
        padding: var(--space-4);
        background: var(--color-primary-surface);
        border-top: 1px solid var(--color-border);
        animation: slideDown 150ms ease;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: var(--space-3);
        margin-bottom: var(--space-3);
      }
      .detail-item {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }
      .detail-label {
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .detail-value {
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      .detail-value.mono {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
      }
      .action-btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: 0.35rem 0.75rem;
        background: var(--color-white);
        color: var(--color-primary);
        border: 1px solid var(--color-primary);
        border-radius: var(--radius-sm);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        cursor: pointer;
        transition: all var(--transition-fast);
      }
      .action-btn:hover {
        background: var(--color-primary);
        color: var(--color-white);
      }
      .copied-msg {
        margin-left: var(--space-2);
        font-size: var(--text-xs);
        color: var(--color-success);
        font-weight: var(--font-medium);
        animation: fadeIn 100ms ease;
      }

      /* ═══ STATUS BADGE (override) ═══ */
      .status-badge.final {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .status-badge.amended,
      .status-badge.corrected {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
      .status-badge.cancelled,
      .status-badge.entered-in-error {
        background: var(--color-error-bg);
        color: var(--color-error);
      }
      .status-badge.preliminary,
      .status-badge.registered {
        background: var(--color-info-bg);
        color: var(--color-info);
      }

      /* ═══ RESPONSIVE ═══ */
      @media (max-width: 768px) {
        .filter-bar {
          flex-direction: column;
          align-items: stretch;
        }
        .summary-stats {
          justify-content: center;
        }
        .loinc-cell,
        .date-cell {
          display: none;
        }
        .lab-table th:nth-child(2),
        .lab-table th:nth-child(6) {
          display: none;
        }
        .detail-grid {
          grid-template-columns: 1fr 1fr;
        }
      }
    `,
  ],
})
export class LabResultsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);

  // ── State ──────────────────────────────────────────────────────────────
  readonly results = signal<LabResult[]>([]);
  readonly loading = signal(false);
  readonly fetched = signal(false);
  readonly error = signal<string | null>(null);
  readonly expandedId = signal<string | null>(null);
  readonly copiedId = signal<string | null>(null);

  // ── Filters ────────────────────────────────────────────────────────────
  readonly searchControl = this.fb.control('');
  readonly flagFilterControl = this.fb.control('');
  readonly patientFilterControl = this.fb.control('');

  // ── Computed: filtered results ─────────────────────────────────────────
  readonly filteredResults = computed(() => {
    let list = this.results();
    const search = this.searchControl.value?.toLowerCase().trim() ?? '';
    const flagFilter = this.flagFilterControl.value ?? '';
    const patientFilter = this.patientFilterControl.value?.toLowerCase().trim() ?? '';

    if (search) {
      list = list.filter(
        (r) => r.testName.toLowerCase().includes(search) || r.loinc.toLowerCase().includes(search),
      );
    }
    if (flagFilter) {
      list = list.filter((r) => {
        const css = getFlag(r.flag).cssClass;
        if (flagFilter === 'normal') return css === 'flag-normal' || css === '';
        if (flagFilter === 'abnormal')
          return css === 'flag-high' || css === 'flag-low' || css === 'flag-abnormal';
        if (flagFilter === 'critical') return css === 'flag-critical';
        return true;
      });
    }
    if (patientFilter) {
      list = list.filter((r) => r.patientId.toLowerCase().includes(patientFilter));
    }
    return list;
  });

  readonly abnormalCount = computed(
    () =>
      this.results().filter((r) => {
        const css = getFlag(r.flag).cssClass;
        return (
          css === 'flag-high' ||
          css === 'flag-low' ||
          css === 'flag-abnormal' ||
          css === 'flag-critical'
        );
      }).length,
  );

  readonly criticalCount = computed(
    () => this.results().filter((r) => getFlag(r.flag).cssClass === 'flag-critical').length,
  );

  // ── Lifecycle ──────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadResults();
  }

  // ── Data loading ───────────────────────────────────────────────────────
  async loadResults(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const resources = await this.http
        .get<
          FhirResourceResponse[]
        >('/api/fhir/resources', { params: { resourceType: 'Observation', limit: '500' } })
        .toPromise();

      if (resources) {
        const parsed: LabResult[] = [];
        for (const r of resources) {
          const result = parseObservation(r.resource);
          if (result) parsed.push(result);
        }
        // Sort: abnormal/critical first, then by date descending
        parsed.sort((a, b) => {
          const aCritical = getFlag(a.flag).cssClass === 'flag-critical' ? 1 : 0;
          const bCritical = getFlag(b.flag).cssClass === 'flag-critical' ? 1 : 0;
          if (aCritical !== bCritical) return bCritical - aCritical;
          const aAbnormal = aCritical || getFlag(a.flag).cssClass !== 'flag-normal' ? 1 : 0;
          const bAbnormal = bCritical || getFlag(b.flag).cssClass !== 'flag-normal' ? 1 : 0;
          if (aAbnormal !== bAbnormal) return bAbnormal - aAbnormal;
          // Then by date descending
          const aDate = a.effectiveDate ? new Date(a.effectiveDate).getTime() : 0;
          const bDate = b.effectiveDate ? new Date(b.effectiveDate).getTime() : 0;
          return bDate - aDate;
        });
        this.results.set(parsed);
      }
    } catch {
      this.error.set(
        'Failed to load lab results. Ensure FHIR Observation resources have been ingested.',
      );
    } finally {
      this.loading.set(false);
      this.fetched.set(true);
    }
  }

  // ── Interactions ───────────────────────────────────────────────────────
  toggleDetail(fhirId: string): void {
    this.expandedId.update((prev) => (prev === fhirId ? null : fhirId));
  }

  async copyResultJson(result: LabResult): Promise<void> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.resource, null, 2));
      this.copiedId.set(result.fhirId);
      setTimeout(() => this.copiedId.set(null), 2000);
    } catch {
      // ignore
    }
  }

  // ── Helpers exposed to template ────────────────────────────────────────
  protected getFlagCss(code: string): string {
    return getFlag(code).cssClass;
  }
  protected getFlagLabel(code: string): string {
    return getFlag(code).label;
  }
  protected formatValue(value: number, loinc: string): string {
    // Temperature: show 1 decimal
    if (loinc === '8310-5') return value.toFixed(1);
    // Integers for most lab values
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toFixed(1);
  }
}
