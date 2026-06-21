/**
 * services/notifications/src/alerts/appointment-consumer.service.ts
 *
 * Kafka consumer for the `appointment.created` and `appointment.updated`
 * topics.
 *
 * Appointment events generate `info`-severity alerts (reminders /
 * notifications) routed to the patient so they are aware of upcoming or
 * changed appointments. These are not clinical emergencies, so they stay
 * at the lowest severity and target the patient role only.
 *
 * Implements NestJS `OnModuleInit` / `OnModuleDestroy` for connection
 * lifecycle management.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createConsumer, type TypedConsumer } from '@caregiver/kafka';
import type {
  AppointmentCreatedPayload,
  AppointmentUpdatedPayload,
} from '@caregiver/contracts';
import { AlertService } from './alert.service.js';

@Injectable()
export class AppointmentConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentConsumerService.name);

  /** Consumer for appointment lifecycle events. */
  private readonly consumer: TypedConsumer;

  constructor(private readonly alertService: AlertService) {
    this.consumer = createConsumer('caregiver-notifications-appointments');
  }

  async onModuleInit(): Promise<void> {
    await this.consumer.connect();

    // Explicit type arguments bind each envelope payload to its contract
    // type (TypeScript cannot infer P from a contravariant handler parameter).
    await this.consumer.subscribe<AppointmentCreatedPayload>(
      'appointment.created',
      async (envelope) => this.handleAppointmentCreated(envelope.payload),
    );
    await this.consumer.subscribe<AppointmentUpdatedPayload>(
      'appointment.updated',
      async (envelope) => this.handleAppointmentUpdated(envelope.payload),
    );

    this.logger.log('Subscribed to appointment.created + appointment.updated.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
    this.logger.log('Appointment consumer disconnected.');
  }

  /**
   * Handle a new appointment — create an info reminder for the patient.
   */
  private async handleAppointmentCreated(payload: AppointmentCreatedPayload): Promise<void> {
    const start = new Date(payload.start).toLocaleString();
    const reason = payload.reason ? ` (${payload.reason})` : '';
    const message = `Appointment reminder: you have an appointment on ${start}${reason}.`;

    await this.alertService.createAndDispatch({
      patientId: payload.patientId,
      alertType: 'appointment_reminder',
      severity: 'info',
      message,
      metadata: {
        appointmentId: payload.appointmentId,
        practitionerId: payload.practitionerId,
        start: payload.start,
        end: payload.end,
        reason: payload.reason,
      },
    });

    this.logger.log(
      `Appointment reminder created for patient ${payload.patientId} (appt ${payload.appointmentId}).`,
    );
  }

  /**
   * Handle an appointment update — notify the patient of the change.
   */
  private async handleAppointmentUpdated(payload: AppointmentUpdatedPayload): Promise<void> {
    const start = payload.start ? new Date(payload.start).toLocaleString() : 'the scheduled time';
    const message = `Appointment update: your appointment was changed to "${payload.newStatus}" (was "${payload.previousStatus}"), scheduled for ${start}.`;

    await this.alertService.createAndDispatch({
      patientId: payload.patientId,
      alertType: 'appointment_update',
      severity: 'info',
      message,
      metadata: {
        appointmentId: payload.appointmentId,
        practitionerId: payload.practitionerId,
        previousStatus: payload.previousStatus,
        newStatus: payload.newStatus,
        start: payload.start,
        end: payload.end,
        reason: payload.reason,
      },
    });

    this.logger.log(
      `Appointment update notification created for patient ${payload.patientId} (appt ${payload.appointmentId}: ${payload.previousStatus} → ${payload.newStatus}).`,
    );
  }
}
