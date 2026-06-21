/**
 * packages/contracts/src/events/vitals-events.ts
 *
 * Event payload types for vitals/observation events.
 *
 * Topic: vitals.recorded → emitted when a nurse/doctor records patient vitals.
 */

/** Payload for `vitals.recorded` — new vital signs were recorded. */
export interface VitalsRecordedPayload {
  /** The database UUID of the vitals record. */
  vitalsId: string;
  /** The patient's user ID. */
  patientId: string;
  /** Who recorded the vitals (user ID). */
  recordedBy: string;
  /** Heart rate (bpm). */
  heartRate?: number;
  /** Systolic blood pressure (mmHg). */
  systolicBp?: number;
  /** Diastolic blood pressure (mmHg). */
  diastolicBp?: number;
  /** Temperature (°C, stored as ×100 integer). */
  temperature?: number;
  /** Oxygen saturation (%). */
  oxygenSaturation?: number;
  /** Respiratory rate (breaths/min). */
  respiratoryRate?: number;
  /** When the vitals were recorded (ISO 8601). */
  recordedAt: string;
  /** FHIR Observation resource ID (if synced). */
  fhirId?: string;
  /** Whether any vital breached a threshold (triggers alert). */
  thresholdBreached?: boolean;
}
