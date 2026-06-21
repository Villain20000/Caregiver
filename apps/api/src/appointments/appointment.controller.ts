/**
 * apps/api/src/appointments/appointment.controller.ts
 *
 * Appointment controller — REST endpoints for appointment management.
 *
 * All endpoints require JWT auth + RBAC permission checks.
 *
 * Endpoints:
 *   POST   /api/appointments          → create (requires 'appointment.schedule')
 *   GET    /api/appointments/:id      → get by ID (requires 'appointment.view_by_patient')
 *   PATCH  /api/appointments/:id      → update (requires 'appointment.reschedule' or 'appointment.cancel')
 */
import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RbacGuard, RequirePermission } from '../common/rbac.guard.js';
import { AppointmentService } from './appointment.service.js';
import type { UserProfile, CreateAppointmentRequest, UpdateAppointmentRequest, AppointmentResponse } from '@caregiver/contracts';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  /**
   * POST /api/appointments — schedule a new appointment.
   * Requires 'appointment.schedule' permission.
   */
  @Post()
  @RequirePermission('appointment.schedule')
  async create(
    @Body() body: CreateAppointmentRequest,
    @Request() req: { user: UserProfile },
  ): Promise<AppointmentResponse> {
    return this.appointmentService.create(body, req.user.id, req.user.role);
  }

  /**
   * GET /api/appointments/:id — get an appointment by ID.
   * Requires 'appointment.view_by_patient' permission.
   */
  @Get(':id')
  @RequirePermission('appointment.view_by_patient')
  async getById(@Param('id') id: string): Promise<AppointmentResponse> {
    return this.appointmentService.getById(id);
  }

  /**
   * PATCH /api/appointments/:id — update (reschedule or cancel) an appointment.
   * Requires 'appointment.reschedule' permission (cancel is also covered).
   */
  @Patch(':id')
  @RequirePermission('appointment.reschedule')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateAppointmentRequest,
    @Request() req: { user: UserProfile },
  ): Promise<AppointmentResponse> {
    return this.appointmentService.update(id, body, req.user.id, req.user.role);
  }
}
