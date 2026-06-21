/**
 * apps/api/src/appointments/appointment.service.ts
 *
 * Appointment service — business logic for appointment CRUD.
 *
 * Persists to PostgreSQL via Drizzle and emits Kafka events for each
 * state change. The notifications microservice consumes these events
 * to send real-time alerts to patients and practitioners.
 */
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createDb, schema, type Database } from '@caregiver/db';
import { KAFKA_PRODUCER } from '../kafka/kafka.module.js';
import type { TypedProducer } from '@caregiver/kafka';
import type {
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  AppointmentResponse,
  AppointmentCreatedPayload,
  AppointmentUpdatedPayload,
} from '@caregiver/contracts';

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger('AppointmentService');
  private readonly db: Database;

  constructor(@Inject(KAFKA_PRODUCER) private readonly producer: TypedProducer) {
    this.db = createDb();
  }

  /**
   * Create a new appointment.
   * Persists to DB and emits `appointment.created` event.
   */
  async create(
    req: CreateAppointmentRequest,
    requestedBy: string,
    requestedByRole: string,
  ): Promise<AppointmentResponse> {
    // Insert into the database.
    const [appointment] = await this.db
      .insert(schema.appointments)
      .values({
        patientId: req.patientId,
        practitionerId: req.practitionerId,
        status: 'booked',
        start: new Date(req.start),
        end: new Date(req.end),
        reason: req.reason,
        notes: req.notes,
      })
      .returning();

    // Drizzle's returning() returns T | undefined; assert non-null (insert always returns a row).
    if (!appointment) throw new Error('Failed to insert appointment');

    // Emit Kafka event.
    const payload: AppointmentCreatedPayload = {
      appointmentId: appointment.id,
      patientId: appointment.patientId!,
      practitionerId: appointment.practitionerId!,
      start: appointment.start.toISOString(),
      end: appointment.end.toISOString(),
      reason: appointment.reason ?? undefined,
    };

    await this.producer.send('appointment.created', payload, {
      userId: requestedBy,
      userRole: requestedByRole,
    });

    this.logger.log(`Appointment ${appointment.id} created by ${requestedBy}`);

    return this.toResponse(appointment);
  }

  /**
   * Get an appointment by ID.
   */
  async getById(id: string): Promise<AppointmentResponse> {
    const [appointment] = await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, id))
      .limit(1);

    if (!appointment) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }

    return this.toResponse(appointment);
  }

  /**
   * Update an appointment (reschedule or cancel).
   * Emits `appointment.updated` event.
   */
  async update(
    id: string,
    req: UpdateAppointmentRequest,
    updatedBy: string,
    updatedByRole: string,
  ): Promise<AppointmentResponse> {
    // Fetch the current appointment (for the previous status).
    const [current] = await this.db
      .select()
      .from(schema.appointments)
      .where(eq(schema.appointments.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }

    // Update the database.
    const [updated] = await this.db
      .update(schema.appointments)
      .set({
        status: req.status ?? current.status,
        start: req.start ? new Date(req.start) : current.start,
        end: req.end ? new Date(req.end) : current.end,
        reason: req.reason ?? current.reason,
        notes: req.notes ?? current.notes,
        updatedAt: new Date(),
      })
      .where(eq(schema.appointments.id, id))
      .returning();

    if (!updated) throw new Error('Failed to update appointment');

    // Emit Kafka event.
    const payload: AppointmentUpdatedPayload = {
      appointmentId: updated.id,
      patientId: updated.patientId!,
      practitionerId: updated.practitionerId!,
      previousStatus: current.status,
      newStatus: updated.status,
      start: updated.start.toISOString(),
      end: updated.end.toISOString(),
      reason: req.reason,
    };

    await this.producer.send('appointment.updated', payload, {
      userId: updatedBy,
      userRole: updatedByRole,
    });

    this.logger.log(`Appointment ${id} updated by ${updatedBy}`);

    return this.toResponse(updated);
  }

  /** Map a DB row to the API response DTO. */
  private toResponse(row: typeof schema.appointments.$inferSelect): AppointmentResponse {
    return {
      id: row.id,
      fhirId: row.fhirId ?? undefined,
      patientId: row.patientId!,
      practitionerId: row.practitionerId!,
      status: row.status,
      start: row.start.toISOString(),
      end: row.end.toISOString(),
      reason: row.reason ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
