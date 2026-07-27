/**
 * apps/api/src/vitals/vitals.service.ts
 *
 * Vitals service — business logic for recording and retrieving vital signs.
 *
 * Persists to PostgreSQL via Drizzle and emits Kafka events.
 * The notifications microservice consumes `vitals.recorded` events to
 * check threshold breaches and dispatch real-time alerts.
 */
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, desc, gte, and } from 'drizzle-orm';
import { createDb, schema, type Database } from '@caregiver/db';
import { KAFKA_PRODUCER } from '../kafka/kafka.module.js';
import type { TypedProducer } from '@caregiver/kafka';
import type {
  RecordVitalsRequest,
  VitalsResponse,
  VitalsTrendResponse,
  VitalsRecordedPayload,
} from '@caregiver/contracts';

@Injectable()
export class VitalsService {
  private readonly logger = new Logger('VitalsService');
  private readonly db: Database;

  constructor(@Inject(KAFKA_PRODUCER) private readonly producer: TypedProducer) {
    this.db = createDb();
  }

  /**
   * Record new vital signs for a patient.
   * Persists to DB and emits `vitals.recorded` event.
   */
  async record(
    req: RecordVitalsRequest,
    recordedBy: string,
    recordedByRole: string,
  ): Promise<VitalsResponse> {
    // Store temperature as ×100 integer (e.g. 98.6 → 9860).
    const temperatureInt = req.temperature ? Math.round(req.temperature * 100) : null;

    // Insert into the database.
    const [vitals] = await this.db
      .insert(schema.vitals)
      .values({
        patientId: req.patientId,
        recordedBy,
        heartRate: req.heartRate ?? null,
        systolicBp: req.systolicBp ?? null,
        diastolicBp: req.diastolicBp ?? null,
        temperature: temperatureInt,
        oxygenSaturation: req.oxygenSaturation ?? null,
        respiratoryRate: req.respiratoryRate ?? null,
        recordedAt: req.recordedAt ? new Date(req.recordedAt) : new Date(),
      })
      .returning();

    if (!vitals) throw new Error('Failed to insert vitals');

    // Check for threshold breaches (simplified — full logic in notifications service).
    const thresholdBreached = this.checkThresholds(req);

    // Emit Kafka event.
    const payload: VitalsRecordedPayload = {
      vitalsId: vitals.id,
      patientId: vitals.patientId,
      recordedBy: vitals.recordedBy,
      heartRate: vitals.heartRate ?? undefined,
      systolicBp: vitals.systolicBp ?? undefined,
      diastolicBp: vitals.diastolicBp ?? undefined,
      temperature: vitals.temperature ? vitals.temperature / 100 : undefined,
      oxygenSaturation: vitals.oxygenSaturation ?? undefined,
      respiratoryRate: vitals.respiratoryRate ?? undefined,
      recordedAt: vitals.recordedAt.toISOString(),
      thresholdBreached,
    };

    await this.producer.send('vitals.recorded', payload, {
      userId: recordedBy,
      userRole: recordedByRole,
    });

    this.logger.log(`Vitals recorded for patient ${req.patientId} by ${recordedBy}`);

    return this.toResponse(vitals);
  }

  /**
   * Get the latest vitals for a patient.
   */
  async getLatestForPatient(patientId: string): Promise<VitalsResponse | null> {
    const [vitals] = await this.db
      .select()
      .from(schema.vitals)
      .where(eq(schema.vitals.patientId, patientId))
      .orderBy(desc(schema.vitals.recordedAt))
      .limit(1);

    return vitals ? this.toResponse(vitals) : null;
  }

  /**
   * Get vitals history for a patient (most recent N records).
   */
  async getHistoryForPatient(patientId: string, limit = 50): Promise<VitalsResponse[]> {
    const results = await this.db
      .select()
      .from(schema.vitals)
      .where(eq(schema.vitals.patientId, patientId))
      .orderBy(desc(schema.vitals.recordedAt))
      .limit(limit);

    return results.map((v: typeof schema.vitals.$inferSelect) => this.toResponse(v));
  }

  /**
   * Get vitals trend for a specific metric over a time period.
   */
  async getTrend(
    patientId: string,
    metric: string,
    days = 7,
  ): Promise<VitalsTrendResponse> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const validMetrics = ['heartRate', 'systolicBp', 'diastolicBp', 'temperature', 'oxygenSaturation', 'respiratoryRate'] as const;
    if (!validMetrics.includes(metric as typeof validMetrics[number])) {
      throw new NotFoundException(`Invalid metric: ${metric}`);
    }

    const results = await this.db
      .select()
      .from(schema.vitals)
      .where(
        and(
          eq(schema.vitals.patientId, patientId),
          gte(schema.vitals.recordedAt, since),
        ),
      )
      .orderBy(desc(schema.vitals.recordedAt));

    const dataPoints = results
      .map((r: typeof schema.vitals.$inferSelect) => {
        const value = (r as Record<string, unknown>)[metric] as number | null;
        if (value === null || value === undefined) return null;
        return {
          timestamp: r.recordedAt.toISOString(),
          value: metric === 'temperature' ? value / 100 : value,
        };
      })
      .filter((dp: { timestamp: string; value: number } | null): dp is { timestamp: string; value: number } => dp !== null);

    if (dataPoints.length === 0) {
      return { patientId, metric, dataPoints: [], min: 0, max: 0, average: 0 };
    }

    const values = dataPoints.map((dp: { timestamp: string; value: number }) => dp.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((a: number, b: number) => a + b, 0) / values.length;

    return { patientId, metric, dataPoints, min, max, average };
  }

  /**
   * Check if any vital breaches a threshold (simplified).
   * Full threshold logic is in the notifications microservice.
   */
  private checkThresholds(req: RecordVitalsRequest): boolean {
    if (req.heartRate !== undefined && (req.heartRate < 40 || req.heartRate > 180)) return true;
    if (req.systolicBp !== undefined && (req.systolicBp < 80 || req.systolicBp > 200)) return true;
    if (req.diastolicBp !== undefined && (req.diastolicBp < 40 || req.diastolicBp > 120)) return true;
    if (req.oxygenSaturation !== undefined && req.oxygenSaturation < 90) return true;
    if (req.temperature !== undefined && (req.temperature < 35 || req.temperature > 40)) return true;
    return false;
  }

  /** Map a DB row to the API response DTO. */
  private toResponse(row: typeof schema.vitals.$inferSelect): VitalsResponse {
    return {
      id: row.id,
      fhirId: row.fhirId ?? undefined,
      patientId: row.patientId,
      recordedBy: row.recordedBy,
      heartRate: row.heartRate ?? undefined,
      systolicBp: row.systolicBp ?? undefined,
      diastolicBp: row.diastolicBp ?? undefined,
      temperature: row.temperature ? row.temperature / 100 : undefined,
      oxygenSaturation: row.oxygenSaturation ?? undefined,
      respiratoryRate: row.respiratoryRate ?? undefined,
      recordedAt: row.recordedAt.toISOString(),
    };
  }
}
