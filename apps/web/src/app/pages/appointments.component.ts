import { Component, inject, signal, computed, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service.js';
import type { AppointmentResponse } from '@caregiver/contracts';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page">
      <h1>Appointments</h1>
      <p class="page-subtitle">Schedule and manage patient appointments.</p>

      @if (canSchedule()) {
        <div class="form-section">
          <h2>Schedule New Appointment</h2>
          <form [formGroup]="appointmentForm" (ngSubmit)="onCreate()">
            <div class="form-row">
              <div class="form-field">
                <label for="patientId">Patient ID</label>
                <input id="patientId" type="text" formControlName="patientId" />
              </div>
              <div class="form-field">
                <label for="practitionerId">Practitioner ID</label>
                <input id="practitionerId" type="text" formControlName="practitionerId" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-field">
                <label for="start">Start Time</label>
                <input id="start" type="datetime-local" formControlName="start" />
              </div>
              <div class="form-field">
                <label for="end">End Time</label>
                <input id="end" type="datetime-local" formControlName="end" />
              </div>
            </div>
            <div class="form-field">
              <label for="reason">Reason</label>
              <input id="reason" type="text" formControlName="reason" />
            </div>
            <button type="submit" [disabled]="creating()" class="create-btn">
              {{ creating() ? 'Scheduling...' : 'Schedule Appointment' }}
            </button>
          </form>
        </div>
      }

      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="loading">Loading appointments...</div>
      }

      @if (!loading() && appointments().length > 0) {
        <div class="appointment-list">
          @for (apt of appointments(); track apt.id) {
            <div class="appointment-card">
              <div class="apt-header">
                <span class="apt-status" [class]="apt.status">{{ apt.status }}</span>
                <span class="apt-time">{{ apt.start | date:'medium' }}</span>
              </div>
              <div class="apt-details">
                <p><strong>Patient:</strong> {{ apt.patientId }}</p>
                <p><strong>Practitioner:</strong> {{ apt.practitionerId }}</p>
                @if (apt.reason) {
                  <p><strong>Reason:</strong> {{ apt.reason }}</p>
                }
              </div>
              @if (apt.status === 'booked' && canSchedule()) {
                <div class="apt-actions">
                  <button (click)="onCancel(apt.id)" class="cancel-btn">Cancel</button>
                  <button (click)="onFulfill(apt.id)" class="fulfill-btn">Mark Fulfilled</button>
                </div>
              }
            </div>
          }
        </div>
      }

      @if (!loading() && appointments().length === 0) {
        <div class="empty-state">
          <p>No appointments found.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { max-width: 900px; margin: 0 auto; }
    h1 { color: #1a237e; margin-bottom: 0.25rem; }
    .page-subtitle { color: #666; margin-top: 0; }
    .loading, .empty-state { padding: 2rem; text-align: center; color: #999; }
    .error-banner {
      margin-top: 1rem; padding: 0.75rem; background: #ffebee; border: 1px solid #ef9a9a;
      border-radius: 4px; color: #c62828; font-size: 0.875rem;
    }
    .form-section {
      margin-top: 1.5rem; padding: 1.5rem; background: white;
      border: 1px solid #e0e0e0; border-radius: 8px;
    }
    .form-section h2 { margin: 0 0 1rem; color: #333; font-size: 1.1rem; }
    .form-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .form-field { flex: 1; }
    .form-field label { display: block; margin-bottom: 0.3rem; font-size: 0.8rem; font-weight: 500; }
    .form-field input {
      width: 100%; padding: 0.5rem; border: 1px solid #ddd;
      border-radius: 4px; box-sizing: border-box;
    }
    .create-btn {
      padding: 0.6rem 1.5rem; background: #1a237e; color: white;
      border: none; border-radius: 4px; cursor: pointer;
    }
    .create-btn:disabled { opacity: 0.6; }
    .appointment-list { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem; }
    .appointment-card {
      padding: 1rem 1.25rem; background: white; border: 1px solid #e0e0e0;
      border-radius: 8px;
    }
    .apt-header { display: flex; justify-content: space-between; margin-bottom: 0.75rem; }
    .apt-status {
      padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem;
      text-transform: uppercase; font-weight: 600;
    }
    .apt-status.booked { background: #e3f2fd; color: #1565c0; }
    .apt-status.cancelled { background: #ffebee; color: #c62828; }
    .apt-status.fulfilled { background: #e8f5e9; color: #2e7d32; }
    .apt-time { color: #666; font-size: 0.875rem; }
    .apt-details p { margin: 0.25rem 0; font-size: 0.875rem; }
    .apt-actions { margin-top: 0.75rem; display: flex; gap: 0.5rem; }
    .cancel-btn, .fulfill-btn {
      padding: 0.3rem 0.7rem; border: 1px solid #ddd; border-radius: 4px;
      cursor: pointer; font-size: 0.8rem;
    }
    .cancel-btn { background: #ffebee; color: #c62828; border-color: #ef9a9a; }
    .fulfill-btn { background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7; }
    .apt-header { display: flex; justify-content: space-between; align-items: center; }
  `],
})
export class AppointmentsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);

  readonly appointments = signal<AppointmentResponse[]>([]);
  readonly loading = signal(true);
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);

  readonly appointmentForm = this.fb.nonNullable.group({
    patientId: ['', [Validators.required]],
    practitionerId: ['', [Validators.required]],
    start: ['', [Validators.required]],
    end: ['', [Validators.required]],
    reason: [''],
  });

  readonly canSchedule = computed(() => {
    const role = this.authService.userRole();
    return role === 'doctor' || role === 'admin' || role === 'nurse';
  });

  ngOnInit(): void {
    this.loadAppointments();
  }

  private async loadAppointments(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const appointments = await this.http.get<AppointmentResponse[]>('/api/appointments').toPromise();
      if (appointments) this.appointments.set(appointments);
    } catch {
      this.error.set('Failed to load appointments.');
    } finally {
      this.loading.set(false);
    }
  }

  async onCreate(): Promise<void> {
    if (this.appointmentForm.invalid) return;
    this.creating.set(true);
    this.error.set(null);
    try {
      const fv = this.appointmentForm.getRawValue();
      const result = await this.http.post<AppointmentResponse>('/api/appointments', {
        patientId: fv.patientId,
        practitionerId: fv.practitionerId,
        start: new Date(fv.start).toISOString(),
        end: new Date(fv.end).toISOString(),
        reason: fv.reason || undefined,
      }).toPromise();
      if (result) {
        this.appointments.update((prev) => [result, ...prev]);
        this.appointmentForm.reset();
      }
    } catch {
      this.error.set('Failed to schedule appointment.');
    } finally {
      this.creating.set(false);
    }
  }

  async onCancel(id: string): Promise<void> {
    this.error.set(null);
    try {
      const result = await this.http.patch<AppointmentResponse>(`/api/appointments/${id}`, { status: 'cancelled' }).toPromise();
      if (result) this.appointments.update((prev) => prev.map((a) => a.id === id ? result : a));
    } catch {
      this.error.set('Failed to cancel appointment.');
    }
  }

  async onFulfill(id: string): Promise<void> {
    this.error.set(null);
    try {
      const result = await this.http.patch<AppointmentResponse>(`/api/appointments/${id}`, { status: 'fulfilled' }).toPromise();
      if (result) this.appointments.update((prev) => prev.map((a) => a.id === id ? result : a));
    } catch {
      this.error.set('Failed to fulfill appointment.');
    }
  }
}