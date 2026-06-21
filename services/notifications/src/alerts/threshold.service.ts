/**
 * services/notifications/src/alerts/threshold.service.ts
 *
 * Threshold evaluation engine for patient vitals.
 *
 * Given a `VitalsRecordedPayload`, this service checks each recorded vital
 * sign against configurable clinical thresholds and returns the most severe
 * breach found (or `null` if all vitals are within safe ranges).
 *
 * Threshold defaults (configurable via environment variables):
 *   - heartRate:          <40 or >180 bpm        → critical
 *   - systolicBp:         <80 or >200 mmHg       → critical
 *   - diastolicBp:        <40 or >120 mmHg       → warning
 *   - oxygenSaturation:   <90 %                  → critical
 *                         <95 %                  → warning
 *   - temperature:        <35 or >40 °C          → critical
 *                         (stored as ×100 integer in the payload, e.g.
 *                          36.5 °C → 3650; thresholds are expressed in °C
 *                          and scaled internally for comparison)
 *
 * Severity ordering (low → high): info < warning < critical < emergency.
 * When multiple vitals breach, the highest severity wins so the alert is
 * routed to the most senior clinical roles.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { VitalsRecordedPayload, AlertSeverity } from '@caregiver/contracts';

/**
 * Result of a threshold check — the severity, a human-readable message,
 * the vital that breached, and the raw value/metadata for downstream use.
 */
export interface ThresholdBreach {
  /** Highest severity among all breached vitals. */
  severity: AlertSeverity;
  /** Human-readable description, e.g. "Critical: Heart rate 190 bpm". */
  message: string;
  /** Which vital breached (heartRate, systolicBp, ...). */
  vitalName: string;
  /** The raw value from the payload that triggered the breach. */
  value: number;
  /** Extra context (threshold bounds, units) for the alert metadata. */
  metadata: Record<string, unknown>;
}

/**
 * Resolved threshold configuration. Bounds are expressed in clinical units
 * (°C for temperature); the service scales temperature internally because
 * the wire payload stores it as a ×100 integer.
 */
interface ThresholdConfig {
  heartRate: { low: number; high: number; severity: AlertSeverity };
  systolicBp: { low: number; high: number; severity: AlertSeverity };
  diastolicBp: { low: number; high: number; severity: AlertSeverity };
  oxygenSaturation: { criticalLow: number; warningLow: number };
  temperature: { low: number; high: number; severity: AlertSeverity };
}

/** Numeric severity rank — higher = more severe. Used to pick the max. */
const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
  emergency: 3,
};

/**
 * Parse a numeric env var with a fallback default.
 * Returns the default if the env var is missing or not a finite number.
 */
function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

@Injectable()
export class ThresholdService {
  private readonly logger = new Logger(ThresholdService.name);

  /** Resolved threshold configuration (read once at construction). */
  private readonly config: ThresholdConfig;

  constructor() {
    // All thresholds are overridable via env vars for tuning without
    // redeploying code. Defaults reflect standard clinical guardrails.
    this.config = {
      heartRate: {
        low: envNumber('THRESHOLD_HEART_RATE_LOW', 40),
        high: envNumber('THRESHOLD_HEART_RATE_HIGH', 180),
        severity: 'critical',
      },
      systolicBp: {
        low: envNumber('THRESHOLD_SYSTOLIC_BP_LOW', 80),
        high: envNumber('THRESHOLD_SYSTOLIC_BP_HIGH', 200),
        severity: 'critical',
      },
      diastolicBp: {
        low: envNumber('THRESHOLD_DIASTOLIC_BP_LOW', 40),
        high: envNumber('THRESHOLD_DIASTOLIC_BP_HIGH', 120),
        severity: 'warning',
      },
      oxygenSaturation: {
        criticalLow: envNumber('THRESHOLD_OXYGEN_CRITICAL_LOW', 90),
        warningLow: envNumber('THRESHOLD_OXYGEN_WARNING_LOW', 95),
      },
      temperature: {
        // Expressed in °C; scaled by 100 when comparing against the payload.
        low: envNumber('THRESHOLD_TEMPERATURE_LOW', 35),
        high: envNumber('THRESHOLD_TEMPERATURE_HIGH', 40),
        severity: 'critical',
      },
    };

    this.logger.log('Threshold configuration loaded from environment.');
  }

  /**
   * Evaluate all recorded vitals against configured thresholds.
   *
   * @param payload - The `vitals.recorded` event payload.
   * @returns The most severe breach found, or `null` if everything is in range.
   */
  checkVitals(payload: VitalsRecordedPayload): ThresholdBreach | null {
    const breaches: ThresholdBreach[] = [];

    // ── Heart rate ────────────────────────────────────────────
    if (payload.heartRate !== undefined) {
      const { low, high, severity } = this.config.heartRate;
      if (payload.heartRate < low || payload.heartRate > high) {
        breaches.push({
          severity,
          message: `Critical: Heart rate ${payload.heartRate} bpm for patient ${payload.patientId}`,
          vitalName: 'heartRate',
          value: payload.heartRate,
          metadata: { low, high, units: 'bpm' },
        });
      }
    }

    // ── Systolic blood pressure ───────────────────────────────
    if (payload.systolicBp !== undefined) {
      const { low, high, severity } = this.config.systolicBp;
      if (payload.systolicBp < low || payload.systolicBp > high) {
        breaches.push({
          severity,
          message: `Critical: Systolic BP ${payload.systolicBp} mmHg for patient ${payload.patientId}`,
          vitalName: 'systolicBp',
          value: payload.systolicBp,
          metadata: { low, high, units: 'mmHg' },
        });
      }
    }

    // ── Diastolic blood pressure ──────────────────────────────
    if (payload.diastolicBp !== undefined) {
      const { low, high, severity } = this.config.diastolicBp;
      if (payload.diastolicBp < low || payload.diastolicBp > high) {
        breaches.push({
          severity,
          message: `Warning: Diastolic BP ${payload.diastolicBp} mmHg for patient ${payload.patientId}`,
          vitalName: 'diastolicBp',
          value: payload.diastolicBp,
          metadata: { low, high, units: 'mmHg' },
        });
      }
    }

    // ── Oxygen saturation (two-tier: critical < 90, warning < 95) ──
    if (payload.oxygenSaturation !== undefined) {
      const { criticalLow, warningLow } = this.config.oxygenSaturation;
      const spo2 = payload.oxygenSaturation;
      if (spo2 < criticalLow) {
        breaches.push({
          severity: 'critical',
          message: `Critical: Oxygen saturation ${spo2}% for patient ${payload.patientId}`,
          vitalName: 'oxygenSaturation',
          value: spo2,
          metadata: { threshold: criticalLow, units: '%' },
        });
      } else if (spo2 < warningLow) {
        breaches.push({
          severity: 'warning',
          message: `Warning: Oxygen saturation ${spo2}% for patient ${payload.patientId}`,
          vitalName: 'oxygenSaturation',
          value: spo2,
          metadata: { threshold: warningLow, units: '%' },
        });
      }
    }

    // ── Temperature (payload stored as ×100 integer) ──────────
    if (payload.temperature !== undefined) {
      const { low, high, severity } = this.config.temperature;
      // Scale °C thresholds to the ×100 wire format for comparison.
      const lowScaled = low * 100;
      const highScaled = high * 100;
      if (payload.temperature < lowScaled || payload.temperature > highScaled) {
        // Convert back to °C for a human-readable message.
        const celsius = (payload.temperature / 100).toFixed(1);
        breaches.push({
          severity,
          message: `Critical: Temperature ${celsius}°C for patient ${payload.patientId}`,
          vitalName: 'temperature',
          value: payload.temperature,
          metadata: { low, high, units: '°C', rawValue: payload.temperature },
        });
      }
    }

    if (breaches.length === 0) {
      return null;
    }

    // Pick the most severe breach so the alert routes to senior roles.
    return breaches.reduce((max, current) =>
      SEVERITY_RANK[current.severity] > SEVERITY_RANK[max.severity] ? current : max,
    );
  }
}
