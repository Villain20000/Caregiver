/**
 * apps/web/src/app/pages/vitals.component.ts
 *
 * Vitals page — record and monitor patient vital signs with interactive trend charts.
 *
 * Features:
 *   - Record new vitals (nurse/doctor/admin)
 *   - Interactive trend line charts (Canvas-based, no external deps)
 *   - Metric selector: HR, BP Systolic/Diastolic, Temp, SpO2
 *   - Time-range selector: 24h, 7d, 30d
 *   - Summary stats: current, min, max, average
 *   - History list with latest recordings
 *   - Dark-mode aware, responsive
 */
import { Component, inject, signal, computed, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service.js';
import { VitalsTrendChartComponent } from './vitals-trend-chart.component.js';
import type {
  VitalsResponse,
  RecordVitalsRequest,
  VitalsTrendResponse,
} from '@caregiver/contracts';

const METRICS_CONFIG = [
  { key: 'heartRate', label: '❤️ Heart Rate', unit: 'bpm', color: '#ef5350' },
  { key: 'systolicBp', label: '🩸 Systolic BP', unit: 'mmHg', color: '#1e88e5' },
  { key: 'diastolicBp', label: '🩸 Diastolic BP', unit: 'mmHg', color: '#43a047' },
  { key: 'temperature', label: '🌡️ Temperature', unit: '°C', color: '#fb8c00' },
  { key: 'oxygenSaturation', label: '💨 O2 Saturation', unit: '%', color: '#8e24aa' },
] as const;

type RangeKey = '24h' | '7d' | '30d';
const RANGE_MAP: Record<RangeKey, number> = { '24h': 1, '7d': 7, '30d': 30 };

@Component({
  selector: 'app-vitals',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, VitalsTrendChartComponent],
  template: `
    <div class="page page-wide">
      <!-- ═══ PAGE HEADER ═══ -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Vital Signs</h1>
          <p class="page-subtitle">Record and monitor patient vital signs.</p>
        </div>
        <div class="header-actions">
          <div class="time-range-toggle">
            @for (r of rangeOptions; track r) {
              <button [class.active]="selectedRange() === r" (click)="onRangeChange(r)">
                {{ r }}
              </button>
            }
          </div>
          @if (canRecord()) {
            <button class="primary-btn" (click)="showRecordForm.set(true)">+ Record Vitals</button>
          }
        </div>
      </div>

      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <!-- ════════════════════════════════════════════════════ -->
      <!-- RECORD FORM (collapsible)                            -->
      <!-- ════════════════════════════════════════════════════ -->
      @if (showRecordForm() && canRecord()) {
        <div class="form-section">
          <div class="form-section-header">
            <h2>Record New Vitals</h2>
            <button class="icon-btn-sm" (click)="showRecordForm.set(false)" aria-label="Close form">
              ✕
            </button>
          </div>
          <form [formGroup]="vitalsForm" (ngSubmit)="onRecord()">
            <div class="form-row">
              <div class="form-field">
                <label for="patientId">Patient ID</label>
                <input id="patientId" type="text" formControlName="patientId" />
              </div>
              <div class="form-field">
                <label for="heartRate">Heart Rate (bpm)</label>
                <input id="heartRate" type="number" formControlName="heartRate" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label for="systolicBp">Systolic BP (mmHg)</label>
                <input id="systolicBp" type="number" formControlName="systolicBp" />
              </div>
              <div class="form-field">
                <label for="diastolicBp">Diastolic BP (mmHg)</label>
                <input id="diastolicBp" type="number" formControlName="diastolicBp" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label for="temperature">Temperature (°C)</label>
                <input id="temperature" type="number" step="0.1" formControlName="temperature" />
              </div>
              <div class="form-field">
                <label for="oxygenSaturation">O2 Saturation (%)</label>
                <input id="oxygenSaturation" type="number" formControlName="oxygenSaturation" />
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="primary-btn" [disabled]="recording()">
                {{ recording() ? 'Recording...' : 'Record Vitals' }}
              </button>
              <button type="button" class="secondary-btn" (click)="showRecordForm.set(false)">
                Cancel
              </button>
            </div>
          </form>
        </div>
      }

      <!-- ════════════════════════════════════════════════════ -->
      <!-- TREND CHARTS                                        -->
      <!-- ════════════════════════════════════════════════════ -->
      @if (!loading()) {
        <div class="trends-section">
          <div class="trends-header">
            <h2>Trends</h2>
            <div class="metric-chips">
              @for (m of METRICS_CONFIG; track m.key) {
                <button
                  class="metric-chip"
                  [style]="{ borderColor: m.color }"
                  [class.active]="selectedMetrics().has(m.key)"
                  (click)="toggleMetric(m.key)"
                >
                  <span class="chip-dot" [style]="{ background: m.color }"></span>
                  {{ m.label }}
                </button>
              }
            </div>
          </div>

          @if (loadingTrends()) {
            <div class="loading"><span class="spinner"></span> Loading trends...</div>
          }

          @if (selectedMetrics().size === 0) {
            <div class="empty-state">
              <p>Select a metric above to view trends.</p>
            </div>
          }

          <div class="chart-grid">
            @for (entry of trendEntries(); track entry.key) {
              @if (entry.data && entry.data.dataPoints.length > 0) {
                <div
                  class="chart-card"
                  [style.borderTopColor]="entry.config?.color ?? 'var(--color-primary)'"
                >
                  <div class="chart-card-header">
                    <span class="chart-card-title">{{ entry.config?.label ?? entry.key }}</span>
                    <span class="chart-card-stats">
                      <span class="stat avg"
                        >{{ entry.data.average.toFixed(1) }} {{ entry.config?.unit }}</span
                      >
                      <span class="stat min">↓{{ entry.data.min }} {{ entry.config?.unit }}</span>
                      <span class="stat max">↑{{ entry.data.max }} {{ entry.config?.unit }}</span>
                    </span>
                  </div>
                  <app-vitals-trend-chart [data]="entry.data" [height]="200" [animated]="true" />
                </div>
              } @else if (entry.data) {
                <div
                  class="chart-card empty-chart"
                  [style.borderTopColor]="entry.config?.color ?? 'var(--color-primary)'"
                >
                  <div class="chart-card-header">
                    <span class="chart-card-title">{{ entry.config?.label ?? entry.key }}</span>
                  </div>
                  <div class="empty-state" style="padding: 2rem;">
                    <p class="text-muted">No data for this period.</p>
                  </div>
                </div>
              }
            }
          </div>
        </div>
      }

      <!-- ════════════════════════════════════════════════════ -->
      <!-- VITALS HISTORY                                      -->
      <!-- ════════════════════════════════════════════════════ -->
      <div class="history-section">
        <h2>Recent Vitals</h2>
        @if (loading()) {
          <div class="loading"><span class="spinner"></span> Loading...</div>
        }
        @if (!loading() && vitalsHistory().length > 0) {
          <div class="vitals-list">
            @for (v of vitalsHistory(); track v.id) {
              <div class="vitals-card">
                <div class="vitals-card-header">
                  <span class="vitals-time">{{ v.recordedAt | date: 'MMM d, h:mm a' }}</span>
                  <span class="vitals-patient">Patient: {{ v.patientId | slice: 0 : 8 }}…</span>
                </div>
                <div class="vitals-grid">
                  @if (v.heartRate) {
                    <span class="vital-item" style="--vital-color: #ef5350">
                      <span class="vital-dot"></span> HR {{ v.heartRate }} bpm
                    </span>
                  }
                  @if (v.systolicBp) {
                    <span class="vital-item" style="--vital-color: #1e88e5">
                      <span class="vital-dot"></span> BP {{ v.systolicBp }}/{{ v.diastolicBp }}
                    </span>
                  }
                  @if (v.temperature) {
                    <span class="vital-item" style="--vital-color: #fb8c00">
                      <span class="vital-dot"></span> Temp {{ v.temperature }}°C
                    </span>
                  }
                  @if (v.oxygenSaturation) {
                    <span class="vital-item" style="--vital-color: #8e24aa">
                      <span class="vital-dot"></span> SpO2 {{ v.oxygenSaturation }}%
                    </span>
                  }
                </div>
              </div>
            }
          </div>
        }
        @if (!loading() && vitalsHistory().length === 0) {
          <div class="empty-state">
            <div class="empty-state-icon">🩺</div>
            <p class="empty-state-text">No vitals recorded yet. Record your first reading above.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* ═══ HEADER ACTIONS ═══ */
      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .time-range-toggle {
        display: inline-flex;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .time-range-toggle button {
        padding: 0.35rem 0.7rem;
        border: none;
        background: var(--color-white);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        cursor: pointer;
        transition: all var(--transition-fast);
      }
      .time-range-toggle button:not(:last-child) {
        border-right: 1px solid var(--color-border);
      }
      .time-range-toggle button.active {
        background: var(--color-primary);
        color: white;
      }
      .time-range-toggle button:hover:not(.active) {
        background: var(--color-fill-hover);
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
        font-size: 0.8rem;
        transition: background var(--transition-fast);
      }
      .icon-btn-sm:hover {
        background: var(--color-fill-hover);
      }

      /* ═══ RECORD FORM ═══ */
      .form-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-4);
      }
      .form-section-header h2 {
        margin: 0;
      }
      .form-actions {
        display: flex;
        gap: var(--space-3);
        margin-top: var(--space-4);
      }

      /* ═══ TRENDS ═══ */
      .trends-section {
        margin-top: var(--space-6);
      }
      .trends-header {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        margin-bottom: var(--space-4);
        flex-wrap: wrap;
      }
      .trends-header h2 {
        margin: 0;
      }
      .metric-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
      }
      .metric-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.3rem 0.65rem;
        border: 1.5px solid var(--color-border);
        border-radius: var(--radius-full);
        background: var(--color-white);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        cursor: pointer;
        transition: all var(--transition-fast);
      }
      .metric-chip:hover {
        background: var(--color-fill-hover);
        border-color: var(--color-text-muted);
      }
      .metric-chip.active {
        background: var(--color-primary-surface);
        font-weight: var(--font-semibold);
      }
      .chip-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      /* ═══ CHART GRID ═══ */
      .chart-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 460px), 1fr));
        gap: var(--space-4);
        margin-bottom: var(--space-6);
      }
      .chart-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        border-top: 3px solid var(--color-primary);
        padding: var(--space-4);
        transition: box-shadow var(--transition-base);
      }
      .chart-card:hover {
        box-shadow: var(--shadow-md);
      }
      .chart-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--space-3);
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .chart-card-title {
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
      }
      .chart-card-stats {
        display: flex;
        gap: var(--space-3);
        font-size: var(--text-xs);
      }
      .stat {
        font-weight: var(--font-medium);
      }
      .stat.avg {
        color: var(--color-text-primary);
      }
      .stat.min {
        color: var(--color-info);
      }
      .stat.max {
        color: var(--color-error);
      }
      .empty-chart {
        opacity: 0.6;
      }

      /* ═══ HISTORY ═══ */
      .history-section {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-6);
        margin-top: var(--space-4);
      }
      .history-section h2 {
        margin: 0 0 var(--space-4);
        font-size: var(--text-lg);
        color: var(--color-text-primary);
      }
      .vitals-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .vitals-card {
        padding: var(--space-3) var(--space-4);
        background: var(--color-fill-hover);
        border-radius: var(--radius-md);
        transition: background var(--transition-fast);
      }
      .vitals-card:hover {
        background: var(--color-bg);
      }
      .vitals-card-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: var(--space-2);
      }
      .vitals-time {
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--color-text-primary);
      }
      .vitals-patient {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }
      .vitals-grid {
        display: flex;
        gap: var(--space-4);
        flex-wrap: wrap;
      }
      .vital-item {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .vital-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--vital-color, var(--color-text-muted));
        flex-shrink: 0;
      }

      /* ═══ RESPONSIVE ═══ */
      @media (max-width: 768px) {
        .chart-grid {
          grid-template-columns: 1fr;
        }
        .trends-header {
          flex-direction: column;
          align-items: flex-start;
        }
        .header-actions {
          width: 100%;
        }
      }
    `,
  ],
})
export class VitalsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  readonly authService = inject(AuthService);

  // ── Form ────────────────────────────────────────────────────────────────
  readonly vitalsForm = this.fb.nonNullable.group({
    patientId: ['', [Validators.required]],
    heartRate: this.fb.nonNullable.control<number | null>(null),
    systolicBp: this.fb.nonNullable.control<number | null>(null),
    diastolicBp: this.fb.nonNullable.control<number | null>(null),
    temperature: this.fb.nonNullable.control<number | null>(null),
    oxygenSaturation: this.fb.nonNullable.control<number | null>(null),
  });

  // ── Signals ─────────────────────────────────────────────────────────────
  readonly vitalsHistory = signal<VitalsResponse[]>([]);
  readonly loading = signal(true);
  readonly recording = signal(false);
  readonly error = signal<string | null>(null);
  readonly showRecordForm = signal(false);

  // Trend state
  readonly selectedRange = signal<RangeKey>('7d');
  readonly selectedMetrics = signal<Set<string>>(
    new Set(['heartRate', 'systolicBp', 'oxygenSaturation']),
  );
  readonly loadingTrends = signal(false);
  readonly trendDataMap = signal<Record<string, VitalsTrendResponse>>({});

  readonly rangeOptions: RangeKey[] = ['24h', '7d', '30d'];
  protected readonly METRICS_CONFIG = METRICS_CONFIG;

  readonly canRecord = computed(() => {
    const role = this.authService.userRole();
    if (!role) return false;
    return role === 'doctor' || role === 'nurse' || role === 'lab_tech' || role === 'admin';
  });

  // ── Computed: precomputed trend entries for Angular 17+ template compat ─
  readonly trendEntries = computed(() => {
    const map = this.trendDataMap();
    return Array.from(this.selectedMetrics()).map((key) => ({
      key,
      data: map[key] as VitalsTrendResponse | undefined,
      config: METRICS_CONFIG.find((m) => m.key === key),
    }));
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadVitals();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  protected getMetricConfig(key: string): (typeof METRICS_CONFIG)[number] | undefined {
    return METRICS_CONFIG.find((m) => m.key === key);
  }

  // ── Data loading ────────────────────────────────────────────────────────
  private async loadVitals(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const userId = this.authService.currentUser()?.id;
      if (userId) {
        const vitals = await this.http
          .get<VitalsResponse[]>(`/api/vitals/patient/${userId}/history`)
          .toPromise();
        if (vitals) this.vitalsHistory.set(vitals);
        await this.loadAllTrends(userId);
      }
    } catch {
      this.error.set('Failed to load vitals data.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadAllTrends(patientId: string): Promise<void> {
    this.loadingTrends.set(true);
    try {
      const days = RANGE_MAP[this.selectedRange()]!;
      const metrics = Array.from(this.selectedMetrics());
      const results = await Promise.all(
        metrics.map((metric) =>
          this.http
            .get<VitalsTrendResponse>(
              `/api/vitals/patient/${patientId}/trend?metric=${metric}&days=${days}`,
            )
            .toPromise(),
        ),
      );
      const map: Record<string, VitalsTrendResponse> = {};
      for (let i = 0; i < metrics.length; i++) {
        const result = results[i];
        const metric = metrics[i]!;
        if (result) map[metric] = result;
      }
      this.trendDataMap.set(map);
    } catch {
      this.error.set('Failed to load trend data.');
    } finally {
      this.loadingTrends.set(false);
    }
  }

  // ── Interactions ────────────────────────────────────────────────────────
  onRangeChange(range: RangeKey): void {
    this.selectedRange.set(range);
    const userId = this.authService.currentUser()?.id;
    if (userId) this.loadAllTrends(userId);
  }

  toggleMetric(key: string): void {
    this.selectedMetrics.update((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    const userId = this.authService.currentUser()?.id;
    if (userId) this.loadAllTrends(userId);
  }

  // ── Record vitals ──────────────────────────────────────────────────────
  async onRecord(): Promise<void> {
    if (this.vitalsForm.invalid) return;
    this.recording.set(true);
    this.error.set(null);
    try {
      const fv = this.vitalsForm.getRawValue();
      const req: RecordVitalsRequest = {
        patientId: fv.patientId,
        heartRate: fv.heartRate ?? undefined,
        systolicBp: fv.systolicBp ?? undefined,
        diastolicBp: fv.diastolicBp ?? undefined,
        temperature: fv.temperature ?? undefined,
        oxygenSaturation: fv.oxygenSaturation ?? undefined,
      };
      const result = await this.http.post<VitalsResponse>('/api/vitals', req).toPromise();
      if (result) {
        this.vitalsHistory.update((prev) => [result, ...prev]);
        this.vitalsForm.reset();
        this.showRecordForm.set(false);
        // Reload trends to include new data
        const userId = this.authService.currentUser()?.id;
        if (userId) this.loadAllTrends(userId);
      }
    } catch {
      this.error.set('Failed to record vitals.');
    } finally {
      this.recording.set(false);
    }
  }
}
