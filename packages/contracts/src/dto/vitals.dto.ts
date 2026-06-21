/**
 * packages/contracts/src/dto/vitals.dto.ts
 *
 * REST DTOs for vitals endpoints.
 * Used by the NestJS API gateway for request validation.
 */

/** Record vitals request body — POST /api/vitals. */
export interface RecordVitalsRequest {
  /** The patient's user ID. */
  patientId: string;
  /** Heart rate (bpm). */
  heartRate?: number;
  /** Systolic blood pressure (mmHg). */
  systolicBp?: number;
  /** Diastolic blood pressure (mmHg). */
  diastolicBp?: number;
  /** Temperature in °C (will be stored as ×100 integer). */
  temperature?: number;
  /** Oxygen saturation (%). */
  oxygenSaturation?: number;
  /** Respiratory rate (breaths/min). */
  respiratoryRate?: number;
  /** When the vitals were measured (ISO 8601). Defaults to now. */
  recordedAt?: string;
}

/** Vitals response body — returned by GET/POST. */
export interface VitalsResponse {
  /** Vitals record UUID. */
  id: string;
  /** FHIR Observation resource ID (if synced). */
  fhirId?: string;
  /** Patient's user ID. */
  patientId: string;
  /** Who recorded the vitals. */
  recordedBy: string;
  /** Heart rate (bpm). */
  heartRate?: number;
  /** Systolic blood pressure (mmHg). */
  systolicBp?: number;
  /** Diastolic blood pressure (mmHg). */
  diastolicBp?: number;
  /** Temperature in °C. */
  temperature?: number;
  /** Oxygen saturation (%). */
  oxygenSaturation?: number;
  /** Respiratory rate (breaths/min). */
  respiratoryRate?: number;
  /** When the vitals were recorded (ISO 8601). */
  recordedAt: string;
}

/** Vitals trend response — aggregated vitals over time. */
export interface VitalsTrendResponse {
  /** Patient's user ID. */
  patientId: string;
  /** Metric name (e.g. 'heartRate', 'systolicBp'). */
  metric: string;
  /** Data points (timestamp + value pairs). */
  dataPoints: Array<{
    timestamp: string;
    value: number;
  }>;
  /** Min value in the range. */
  min: number;
  /** Max value in the range. */
  max: number;
  /** Average value. */
  average: number;
}
