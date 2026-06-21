/**
 * packages/fhir-types/src/resources/appointment.ts
 *
 * FHIR R4 `Appointment` resource — a booking of a healthcare event among
 * patient(s), practitioner(s), and/or device(s) for a specific date/time.
 *
 * Used by: ALL clinical roles (scheduling is universal).
 *
 * @see https://hl7.org/fhir/R4/appointment.html
 */
import type { DomainResource, Identifier, Reference, CodeableConcept, Period, FhirString, FhirInstant, FhirDateTime, FhirPositiveInt } from '../base.js';

/** Appointment status — FHIR R4 value set. */
export type AppointmentStatus =
  | 'proposed'
  | 'booked'
  | 'arrived'
  | 'fulfilled'
  | 'cancelled'
  | 'noshow'
  | 'entered-in-error'
  | 'checked-in'
  | 'waitlist';

/** Appointment participant — a person/resource involved in the appointment. */
export interface AppointmentParticipant {
  /** Type of participant (practitioner, patient, device, etc.). */
  type?: CodeableConcept[];
  /** The person/resource participating. */
  actor?: Reference;
  /** Whether this participant is required (required, optional, information-only). */
  required?: 'required' | 'optional' | 'information-only';
  /** Participation status of this participant. */
  status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  /** Time period when the participant is involved. */
  period?: Period;
}

/** FHIR R4 Appointment resource. */
export interface Appointment extends DomainResource {
  resourceType: 'Appointment';
  /** Business identifiers (appointment number, etc.). */
  identifier?: Identifier[];
  /** Cancellation reason (if status is 'cancelled'). */
  cancellationReason?: CodeableConcept;
  /** Current status of the appointment. */
  status: AppointmentStatus;
  /** The service category (e.g. 'general practice', 'specialist'). */
  serviceCategory?: CodeableConcept[];
  /** The specific service type (e.g. 'follow-up', 'consultation'). */
  serviceType?: CodeableConcept[];
  /** Specialty of the practitioners involved. */
  specialty?: CodeableConcept[];
  /** Type of appointment (routine, urgent, etc.). */
  appointmentType?: CodeableConcept;
  /** Reason the appointment is being scheduled (coded). */
  reasonCode?: CodeableConcept[];
  /** Reason the appointment is being scheduled (condition references). */
  reasonReference?: Reference[];
  /** Priority of the appointment (1 = highest). */
  priority?: FhirPositiveInt;
  /** Brief description of the appointment. */
  description?: FhirString;
  /** Additional information to support the appointment. */
  supportingInformation?: Reference[];
  /** When the appointment starts. */
  start?: FhirInstant;
  /** When the appointment ends. */
  end?: FhirInstant;
  /** Minutes from start to end (duration). */
  minutesDuration?: FhirPositiveInt;
  /** Slots from which this appointment was created. */
  slot?: Reference[];
  /** Whether this was created by the patient (vs. system). */
  created?: FhirDateTime;
  /** Additional comments from the patient or practitioner. */
  comment?: FhirString;
  /** Instructions for the patient. */
  patientInstruction?: FhirString;
  /** Organization responsible for the appointment. */
  basedOn?: Reference[];
  /** Participants in the appointment. */
  participant: AppointmentParticipant[];
  /** Periods of time when the appointment is proposed/available. */
  requestedPeriod?: Period[];
}
