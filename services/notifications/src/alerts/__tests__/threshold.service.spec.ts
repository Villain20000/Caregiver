/**
 * services/notifications/src/alerts/__tests__/threshold.service.spec.ts
 *
 * Unit tests for ThresholdService — evaluates patient vitals against
 * clinical thresholds and returns the most severe breach.
 *
 * NOTE: temperature is stored in the payload as a ×100 integer
 * (e.g. 37.0 °C → 3700). Thresholds are expressed in °C and scaled
 * internally by the service.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { VitalsRecordedPayload } from '@caregiver/contracts';
import { ThresholdService } from '../threshold.service.js';

describe('ThresholdService', () => {
  let service: ThresholdService;

  beforeEach(() => {
    // Clear threshold env overrides so defaults are used.
    delete process.env.THRESHOLD_HEART_RATE_LOW;
    delete process.env.THRESHOLD_HEART_RATE_HIGH;
    delete process.env.THRESHOLD_SYSTOLIC_BP_LOW;
    delete process.env.THRESHOLD_SYSTOLIC_BP_HIGH;
    delete process.env.THRESHOLD_DIASTOLIC_BP_LOW;
    delete process.env.THRESHOLD_DIASTOLIC_BP_HIGH;
    delete process.env.THRESHOLD_OXYGEN_CRITICAL_LOW;
    delete process.env.THRESHOLD_OXYGEN_WARNING_LOW;
    delete process.env.THRESHOLD_TEMPERATURE_LOW;
    delete process.env.THRESHOLD_TEMPERATURE_HIGH;
    service = new ThresholdService();
  });

  /** Build a payload with all vitals in safe range by default. */
  const basePayload = (overrides: Partial<VitalsRecordedPayload> = {}): VitalsRecordedPayload => ({
    vitalsId: 'vitals-1',
    patientId: 'patient-42',
    recordedBy: 'nurse-1',
    heartRate: 72,
    systolicBp: 120,
    diastolicBp: 80,
    oxygenSaturation: 98,
    // 37.0 °C stored as ×100 integer.
    temperature: 3700,
    recordedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('returns null when all vitals are within safe ranges', () => {
    const result = service.checkVitals(basePayload());
    expect(result).toBeNull();
  });

  // ── Heart rate ───────────────────────────────────────────────
  it('flags a critical heart rate of 190 bpm', () => {
    const result = service.checkVitals(basePayload({ heartRate: 190 }));
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
    expect(result!.vitalName).toBe('heartRate');
    expect(result!.value).toBe(190);
  });

  it('flags a critically low heart rate of 35 bpm', () => {
    const result = service.checkVitals(basePayload({ heartRate: 35 }));
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
    expect(result!.vitalName).toBe('heartRate');
  });

  // ── Blood pressure ───────────────────────────────────────────
  it('flags a critical systolic BP of 210 mmHg', () => {
    const result = service.checkVitals(basePayload({ systolicBp: 210 }));
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
    expect(result!.vitalName).toBe('systolicBp');
  });

  it('flags a warning diastolic BP of 125 mmHg', () => {
    const result = service.checkVitals(basePayload({ diastolicBp: 125 }));
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.vitalName).toBe('diastolicBp');
  });

  // ── Oxygen saturation (two-tier) ─────────────────────────────
  it('flags a critical O2 saturation of 88%', () => {
    const result = service.checkVitals(basePayload({ oxygenSaturation: 88 }));
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
    expect(result!.vitalName).toBe('oxygenSaturation');
  });

  it('flags a warning O2 saturation of 93%', () => {
    const result = service.checkVitals(basePayload({ oxygenSaturation: 93 }));
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.vitalName).toBe('oxygenSaturation');
  });

  // ── Temperature (stored as ×100 integer) ─────────────────────
  it('flags a critical temperature of 41 °C (4100 in payload)', () => {
    const result = service.checkVitals(basePayload({ temperature: 4100 }));
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
    expect(result!.vitalName).toBe('temperature');
    expect(result!.value).toBe(4100);
  });

  // ── Message content ──────────────────────────────────────────
  it('includes the patient ID and the vital name in the breach message', () => {
    const result = service.checkVitals(basePayload({ heartRate: 190 }));
    expect(result).not.toBeNull();
    expect(result!.message).toContain('patient-42');
    expect(result!.message).toContain('Heart rate');
  });

  // ── Severity precedence ──────────────────────────────────────
  it('returns the most severe breach when multiple vitals breach', () => {
    // diastolicBp 125 → warning; heartRate 190 → critical.
    const result = service.checkVitals(
      basePayload({ diastolicBp: 125, heartRate: 190 }),
    );
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
    expect(result!.vitalName).toBe('heartRate');
  });
});
