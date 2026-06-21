/**
 * packages/contracts/src/events/appointment-events.ts
 *
 * Event payload types for appointment lifecycle events.
 *
 * Topics:
 *   - appointment.created → emitted when a new appointment is scheduled
 *   - appointment.updated → emitted when an appointment is rescheduled/cancelled
 */

/** Payload for `appointment.created` — a new appointment was scheduled. */
export interface AppointmentCreatedPayload {
  /** The database UUID of the appointment. */
  appointmentId: string;
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
  /** FHIR Appointment resource ID (if synced). */
  fhirId?: string;
}

/** Payload for `appointment.updated` — an appointment was modified. */
export interface AppointmentUpdatedPayload {
  /** The database UUID of the appointment. */
  appointmentId: string;
  /** The patient's user ID. */
  patientId: string;
  /** The practitioner's user ID. */
  practitionerId: string;
  /** Previous status. */
  previousStatus: string;
  /** New status. */
  newStatus: string;
  /** Updated start time (if changed). */
  start?: string;
  /** Updated end time (if changed). */
  end?: string;
  /** Reason for the update. */
  reason?: string;
}
