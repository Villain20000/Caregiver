import { Component, inject, signal, computed, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service.js';
import type { VitalsResponse, RecordVitalsRequest } from '@caregiver/contracts';

@Component({
  selector: 'app-vitals',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page">
      <h1>Vital Signs</h1>
      <p class="page-subtitle">Record and monitor patient vital signs.</p>

      @if (canRecord()) {
        <div class="form-section">
          <h2>Record New Vitals</h2>
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
            @if (error()) {
              <div class="error-msg">{{ error() }}</div>
            }
            <button type="submit" [disabled]="recording()" class="record-btn">
              {{ recording() ? 'Recording...' : 'Record Vitals' }}
            </button>
          </form>
        </div>
      }

      <div class="history-section">
        <h2>Recent Vitals</h2>
        @if (loading()) {
          <div class="loading">Loading...</div>
        }
        @if (!loading() && vitalsHistory().length > 0) {
          <div class="vitals-list">
            @for (v of vitalsHistory(); track v.id) {
              <div class="vitals-card">
                <div class="vitals-time">{{ v.recordedAt | date:'short' }}</div>
                <div class="vitals-grid">
                  @if (v.heartRate) { <span>HR: {{ v.heartRate }} bpm</span> }
                  @if (v.systolicBp) { <span>BP: {{ v.systolicBp }}/{{ v.diastolicBp }}</span> }
                  @if (v.temperature) { <span>Temp: {{ v.temperature }}°C</span> }
                  @if (v.oxygenSaturation) { <span>O2: {{ v.oxygenSaturation }}%</span> }
                </div>
              </div>
            }
          </div>
        }
        @if (!loading() && vitalsHistory().length === 0) {
          <div class="empty-state">No vitals recorded yet.</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 900px; margin: 0 auto; }
    h1 { color: #1a237e; }
    .page-subtitle { color: #666; margin-top: 0; }
    .form-section, .history-section {
      margin-top: 1.5rem; padding: 1.5rem; background: white;
      border: 1px solid #e0e0e0; border-radius: 8px;
    }
    h2 { margin-top: 0; color: #333; font-size: 1.1rem; }
    .form-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .form-field { flex: 1; }
    .form-field label { display: block; margin-bottom: 0.3rem; font-size: 0.8rem; font-weight: 500; }
    .form-field input {
      width: 100%; padding: 0.5rem; border: 1px solid #ddd;
      border-radius: 4px; box-sizing: border-box;
    }
    .error-msg { margin-bottom: 0.75rem; padding: 0.5rem; background: #ffebee; border-radius: 4px; color: #c62828; font-size: 0.8rem; }
    .record-btn {
      padding: 0.6rem 1.5rem; background: #1a237e; color: white;
      border: none; border-radius: 4px; cursor: pointer;
    }
    .record-btn:disabled { opacity: 0.6; }
    .vitals-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .vitals-card {
      padding: 0.75rem 1rem; background: #f5f5f5; border-radius: 6px;
    }
    .vitals-time { font-size: 0.75rem; color: #999; margin-bottom: 0.4rem; }
    .vitals-grid { display: flex; gap: 1.5rem; font-size: 0.875rem; flex-wrap: wrap; }
    .loading, .empty-state { text-align: center; color: #999; padding: 1rem; }
  `],
})
export class VitalsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  readonly authService = inject(AuthService);

  readonly vitalsForm = this.fb.nonNullable.group({
    patientId: ['', [Validators.required]],
    heartRate: this.fb.nonNullable.control<number | null>(null),
    systolicBp: this.fb.nonNullable.control<number | null>(null),
    diastolicBp: this.fb.nonNullable.control<number | null>(null),
    temperature: this.fb.nonNullable.control<number | null>(null),
    oxygenSaturation: this.fb.nonNullable.control<number | null>(null),
  });

  readonly vitalsHistory = signal<VitalsResponse[]>([]);
  readonly loading = signal(true);
  readonly recording = signal(false);
  readonly error = signal<string | null>(null);

  readonly canRecord = computed(() => {
    const role = this.authService.userRole();
    if (!role) return false;
    return role === 'doctor' || role === 'nurse' || role === 'lab_tech' || role === 'admin';
  });

  ngOnInit(): void {
    this.loadVitals();
  }

  private async loadVitals(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const userId = this.authService.currentUser()?.id;
      if (userId) {
        const vitals = await this.http.get<VitalsResponse[]>(`/api/vitals/patient/${userId}/history`).toPromise();
        if (vitals) this.vitalsHistory.set(vitals);
      }
    } catch {
      this.error.set('Failed to load vitals history.');
    } finally {
      this.loading.set(false);
    }
  }

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
      }
    } catch {
      this.error.set('Failed to record vitals.');
    } finally {
      this.recording.set(false);
    }
  }
}