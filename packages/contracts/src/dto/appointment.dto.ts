/**
 * packages/contracts/src/dto/appointment.dto.ts
 *
 * REST DTOs for appointment endpoints.
 * Used by the NestJS API gateway for request validation.
 */

/** Create appointment request body — POST /api/appointments. */
export interface CreateAppointmentRequest {
  /** The patient's user ID. */
  patientId: string;
  /** The practitioner's user ID. */
  practitionerId: string;
  /** Appointment start time (ISO 8601). */
  start: string;
  /** Appointment end time (ISO 8601). */
  end: string;
  /** Reason for the appointment. */
  reason?: string;
  /** Additional notes. */
  notes?: string;
}

/** Update appointment request body — PATCH /api/appointments/:id. */
export interface UpdateAppointmentRequest {
  /** New status (if changing). */
  status?: 'proposed' | 'booked' | 'arrived' | 'fulfilled' | 'cancelled' | 'noshow' | 'checked-in';
  /** New start time (if rescheduling). */
  start?: string;
  /** New end time (if rescheduling). */
  end?: string;
  /** Updated reason. */
  reason?: string;
  /** Updated notes. */
  notes?: string;
}

/** Appointment response body — returned by GET/POST/PATCH. */
export interface AppointmentResponse {
  /** Appointment UUID. */
  id: string;
  /** FHIR Appointment resource ID (if synced). */
  fhirId?: string;
  /** Patient's user ID. */
  patientId: string;
  /** Practitioner's user ID. */
  practitionerId: string;
  /** Current status. */
  status: string;
  /** Start time (ISO 8601). */
  start: string;
  /** End time (ISO 8601). */
  end: string;
  /** Reason. */
  reason?: string;
  /** Notes. */
  notes?: string;
  /** Creation timestamp. */
  createdAt: string;
  /** Last update timestamp. */
  updatedAt: string;
}
