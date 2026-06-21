/**
 * apps/web/src/app/pages/appointments.component.ts
 *
 * Appointments page — standalone component for appointment management.
 *
 * For Phase 2, this is a simple list view that fetches appointments
 * from the API gateway. Full CRUD UI will be built in Phase 3.
 */
import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../services/auth.service.js';
import type { AppointmentResponse } from '@caregiver/contracts';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <h1>Appointments</h1>
      <p class="page-subtitle">Schedule and manage patient appointments.</p>

      <!-- Loading state. -->
      @if (loading()) {
        <div class="loading">Loading appointments...</div>
      }

      <!-- Appointment list. -->
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
            </div>
          }
        </div>
      }

      <!-- Empty state. -->
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
  `],
})
export class AppointmentsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // Appointments list (signal).
  readonly appointments = signal<AppointmentResponse[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    // Fetch appointments for the current user.
    // In a full implementation, this would call GET /api/appointments?patientId=...
    // For Phase 2, we just simulate an empty list.
    this.loading.set(false);
  }
}
