/**
 * apps/web/src/app/pages/ai-diagnosis.component.ts
 *
 * AI Diagnosis page — standalone component for requesting and reviewing
 * AI-assisted diagnoses.
 *
 * For Phase 2, this is a simple form to submit a diagnosis request
 * and a list of recent diagnoses. Full review UI (approve/override)
 * will be built in Phase 3.
 */
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service.js';
import type { AiDiagnosisResponse, RequestDiagnosisRequest } from '@caregiver/contracts';

@Component({
  selector: 'app-ai-diagnosis',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page">
      <h1>AI Diagnostics</h1>
      <p class="page-subtitle">Request AI-assisted diagnoses powered by RAG + Llama-3.</p>

      <!-- Diagnosis request form (shown for roles with 'ai.request_diagnosis' permission). -->
      @if (canRequest()) {
        <div class="form-section">
          <h2>Request New Diagnosis</h2>
          <form [formGroup]="diagnosisForm" (ngSubmit)="onRequest()">
            <div class="form-field">
              <label for="patientId">Patient ID</label>
              <input id="patientId" type="text" formControlName="patientId" />
            </div>
            <div class="form-field">
              <label for="inputContext">Clinical Context / Question</label>
              <textarea
                id="inputContext"
                formControlName="inputContext"
                rows="4"
                placeholder="Describe the clinical context or question for the AI..."
              ></textarea>
            </div>
            <button type="submit" [disabled]="requesting()" class="request-btn">
              {{ requesting() ? 'Requesting...' : 'Request Diagnosis' }}
            </button>
          </form>
        </div>
      }

      <!-- Recent diagnoses list. -->
      <div class="history-section">
        <h2>Recent Diagnoses</h2>
        @if (loading()) {
          <div class="loading">Loading...</div>
        }
        @if (!loading() && diagnoses().length > 0) {
          <div class="diagnosis-list">
            @for (d of diagnoses(); track d.id) {
              <div class="diagnosis-card">
                <div class="diagnosis-header">
                  <span class="status-badge" [class]="d.status">{{ d.status }}</span>
                  <span class="diagnosis-time">{{ d.createdAt | date:'short' }}</span>
                </div>
                <div class="diagnosis-body">
                  <p><strong>Patient:</strong> {{ d.patientId }}</p>
                  @if (d.diagnosis) {
                    <div class="diagnosis-text">
                      <strong>AI Diagnosis:</strong>
                      <p>{{ d.diagnosis }}</p>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }
        @if (!loading() && diagnoses().length === 0) {
          <div class="empty-state">No diagnoses requested yet.</div>
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
    .form-field { margin-bottom: 1rem; }
    .form-field label { display: block; margin-bottom: 0.3rem; font-size: 0.8rem; font-weight: 500; }
    .form-field input, .form-field textarea {
      width: 100%; padding: 0.5rem; border: 1px solid #ddd;
      border-radius: 4px; box-sizing: border-box; font-family: inherit;
    }
    .request-btn {
      padding: 0.6rem 1.5rem; background: #1a237e; color: white;
      border: none; border-radius: 4px; cursor: pointer;
    }
    .request-btn:disabled { opacity: 0.6; }
    .diagnosis-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .diagnosis-card {
      padding: 1rem; background: #f5f5f5; border-radius: 6px;
    }
    .diagnosis-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
    .status-badge {
      padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem;
      text-transform: uppercase; font-weight: 600;
    }
    .status-badge.requested { background: #fff3e0; color: #e65100; }
    .status-badge.processing { background: #e3f2fd; color: #1565c0; }
    .status-badge.completed { background: #e8f5e9; color: #2e7d32; }
    .status-badge.approved { background: #c8e6c9; color: #1b5e20; }
    .status-badge.overridden { background: #ffebee; color: #c62828; }
    .diagnosis-time { font-size: 0.75rem; color: #999; }
    .diagnosis-text { margin-top: 0.5rem; padding: 0.75rem; background: white; border-radius: 4px; }
    .diagnosis-text p { margin: 0.25rem 0 0; }
    .loading, .empty-state { text-align: center; color: #999; padding: 1rem; }
  `],
})
export class AiDiagnosisComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // Diagnosis request form.
  readonly diagnosisForm = this.fb.nonNullable.group({
    patientId: ['', [Validators.required]],
    inputContext: ['', [Validators.required]],
  });

  // State signals.
  readonly diagnoses = signal<AiDiagnosisResponse[]>([]);
  readonly loading = signal(true);
  readonly requesting = signal(false);

  /** Whether the current user can request diagnoses (based on RBAC). */
  readonly canRequest = computed(() => {
    const role = this.authService.userRole();
    if (!role) return false;
    return role === 'doctor' || role === 'radiologist' || role === 'medical_director' || role === 'admin';
  });

  ngOnInit(): void {
    this.loading.set(false);
  }

  /** Handle diagnosis request form submission. */
  async onRequest(): Promise<void> {
    if (this.diagnosisForm.invalid) return;

    this.requesting.set(true);
    try {
      const formValue = this.diagnosisForm.getRawValue();
      const req: RequestDiagnosisRequest = {
        patientId: formValue.patientId,
        inputContext: formValue.inputContext,
      };

      const result = await this.http.post<AiDiagnosisResponse>('/api/ai/diagnose', req).toPromise();
      if (result) {
        // Prepend the new diagnosis to the list.
        this.diagnoses.update((prev) => [result, ...prev]);
        this.diagnosisForm.reset();
      }
    } catch {
      // Error handling — show a toast in Phase 3.
    } finally {
      this.requesting.set(false);
    }
  }
}
