/**
 * apps/web/src/app/pages/patient-summary.component.ts
 *
 * Patient Summary page — aggregated view of all data for a single patient.
 *
 * Shows vitals, appointments, orders, diagnoses, and claims in one place.
 * This is the default landing page when clicking any patient ID.
 *
 * 📝 Feature: Patient Summary / Chart (#1)
 * Future: Expand with clinical notes (SOAP), lab results, and alerts.
 */
import { Component, inject, signal, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { PatientFavoritesService } from '../services/patient-favorites.service.js';
import type {
  VitalsResponse,
  AppointmentResponse,
  OrderResponse,
  AiDiagnosisResponse,
} from '@caregiver/contracts';

@Component({
  selector: 'app-patient-summary',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-wide">
      <div class="page-header">
        <div>
          <h1>Patient Summary</h1>
          <p class="page-subtitle">Patient ID: {{ patientId() }}</p>
        </div>
        <div class="header-actions">
          <button class="action-btn" (click)="favoritesService.toggleFavorite(patientId())">
            {{ favoritesService.isFavorite(patientId()) ? '★ Pinned' : '☆ Pin Patient' }}
          </button>
        </div>
      </div>

      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <div class="summary-grid">
        <!-- Vitals Card -->
        <div class="form-section">
          <div class="card-header">
            <h2>❤️ Recent Vitals</h2>
            <a routerLink="/vitals" class="card-link">View all</a>
          </div>
          @if (latestVitals(); as v) {
            <div class="vitals-grid">
              @if (v.heartRate) {
                <span class="vital-badge"><strong>HR</strong> {{ v.heartRate }} bpm</span>
              }
              @if (v.systolicBp) {
                <span class="vital-badge"
                  ><strong>BP</strong> {{ v.systolicBp }}/{{ v.diastolicBp }}</span
                >
              }
              @if (v.temperature) {
                <span class="vital-badge"><strong>Temp</strong> {{ v.temperature }}°C</span>
              }
              @if (v.oxygenSaturation) {
                <span class="vital-badge"><strong>SpO2</strong> {{ v.oxygenSaturation }}%</span>
              }
            </div>
          } @else {
            <p class="text-muted">No vitals recorded.</p>
          }
        </div>

        <!-- Appointments Card -->
        <div class="form-section">
          <div class="card-header">
            <h2>📅 Recent Appointments</h2>
            <a routerLink="/appointments" class="card-link">View all</a>
          </div>
          @if (appointments().length > 0) {
            @for (apt of appointments().slice(0, 3); track apt.id) {
              <div class="summary-row">
                <span class="status-badge" [class]="apt.status">{{ apt.status }}</span>
                <span>{{ apt.start | date: 'mediumDate' }}</span>
              </div>
            }
          } @else {
            <p class="text-muted">No appointments found.</p>
          }
        </div>

        <!-- Orders Card -->
        <div class="form-section">
          <div class="card-header">
            <h2>💊 Active Orders</h2>
            <a routerLink="/orders" class="card-link">View all</a>
          </div>
          @if (orders().length > 0) {
            @for (o of orders().slice(0, 3); track o.id) {
              <div class="summary-row">
                <span class="status-badge" [class]="o.status">{{ o.status }}</span>
                <span>{{ o.display }}</span>
              </div>
            }
          } @else {
            <p class="text-muted">No active orders.</p>
          }
        </div>

        <!-- AI Diagnoses Card -->
        <div class="form-section">
          <div class="card-header">
            <h2>🤖 AI Diagnoses</h2>
            <a routerLink="/ai" class="card-link">View all</a>
          </div>
          @if (diagnoses().length > 0) {
            @for (d of diagnoses().slice(0, 3); track d.id) {
              <div class="summary-row">
                <span class="status-badge" [class]="d.status">{{ d.status }}</span>
                <span>{{ d.createdAt | date: 'mediumDate' }}</span>
              </div>
            }
          } @else {
            <p class="text-muted">No diagnoses requested.</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .page-wide {
        max-width: 1400px;
        margin: 0 auto;
        animation: fadeIn 200ms ease;
      }
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .page-header h1 {
        margin: 0;
      }
      .page-subtitle {
        margin: 0.25rem 0 0;
        color: var(--color-text-muted);
        font-family: monospace;
      }
      .header-actions {
        display: flex;
        gap: 0.5rem;
      }
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
        gap: 1.5rem;
      }
      .form-section {
        padding: 1.25rem;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
      }
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
      }
      .card-header h2 {
        margin: 0;
        font-size: 1rem;
      }
      .card-link {
        font-size: 0.8rem;
        color: var(--color-accent);
      }
      .vitals-grid {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .vital-badge {
        padding: 0.35rem 0.7rem;
        background: var(--color-fill-hover);
        border-radius: 6px;
        font-size: 0.85rem;
      }
      .vital-badge strong {
        color: var(--color-primary);
        margin-right: 0.25rem;
      }
      .summary-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--color-border-light);
        font-size: 0.875rem;
      }
      .summary-row:last-child {
        border-bottom: none;
      }
      .text-muted {
        color: var(--color-text-muted);
        font-size: 0.85rem;
      }
      .error-banner {
        padding: 0.75rem;
        background: var(--color-error-bg);
        border: 1px solid var(--color-error-border);
        border-radius: 4px;
        color: var(--color-error);
        margin-bottom: 1rem;
      }

      @media (max-width: 768px) {
        .summary-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class PatientSummaryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly favoritesService = inject(PatientFavoritesService);

  readonly patientId = signal<string>('');
  readonly error = signal<string | null>(null);
  readonly latestVitals = signal<VitalsResponse | null>(null);
  readonly appointments = signal<AppointmentResponse[]>([]);
  readonly orders = signal<OrderResponse[]>([]);
  readonly diagnoses = signal<AiDiagnosisResponse[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.patientId.set(id);
    this.favoritesService.trackRecent(id);
    this.loadPatientData(id);
  }

  private async loadPatientData(patientId: string): Promise<void> {
    try {
      const [vitals, appointments, orders, diagnoses] = await Promise.all([
        this.http.get<VitalsResponse>(`/api/vitals/patient/${patientId}`).toPromise(),
        this.http
          .get<AppointmentResponse[]>(`/api/appointments?patientId=${patientId}`)
          .toPromise(),
        this.http.get<OrderResponse[]>(`/api/orders?patientId=${patientId}`).toPromise(),
        this.http
          .get<AiDiagnosisResponse[]>(`/api/ai/diagnoses?patientId=${patientId}`)
          .toPromise(),
      ]);
      if (vitals) this.latestVitals.set(vitals);
      if (appointments) this.appointments.set(appointments);
      if (orders) this.orders.set(orders);
      if (diagnoses) this.diagnoses.set(diagnoses);
    } catch {
      this.error.set('Failed to load patient data.');
    }
  }
}
