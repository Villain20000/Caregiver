/**
 * apps/api/src/appointments/appointment.module.ts
 *
 * Appointment module — handles appointment CRUD.
 * Emits Kafka events for each state change (consumed by notifications service).
 */
import { Module } from '@nestjs/common';
import { AppointmentController } from './appointment.controller.js';
import { AppointmentService } from './appointment.service.js';

@Module({
  controllers: [AppointmentController],
  providers: [AppointmentService],
})
export class AppointmentModule {}
