/**
 * apps/api/src/vitals/vitals.controller.ts
 *
 * Vitals controller — REST endpoints for vital signs.
 *
 * Endpoints:
 *   POST /api/vitals                    → record vitals (requires 'vitals.record')
 *   GET  /api/vitals/patient/:patientId → get latest vitals (requires 'vitals.view')
 *   GET  /api/vitals/patient/:patientId/history → get history (requires 'vitals.view')
 */
import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RbacGuard, RequirePermission } from '../common/rbac.guard.js';
import { VitalsService } from './vitals.service.js';
import type { UserProfile, RecordVitalsRequest, VitalsResponse } from '@caregiver/contracts';

@Controller('vitals')
@UseGuards(JwtAuthGuard, RbacGuard)
export class VitalsController {
  constructor(private readonly vitalsService: VitalsService) {}

  /**
   * POST /api/vitals — record new vital signs.
   * Requires 'vitals.record' permission.
   */
  @Post()
  @RequirePermission('vitals.record')
  async record(
    @Body() body: RecordVitalsRequest,
    @Request() req: { user: UserProfile },
  ): Promise<VitalsResponse> {
    return this.vitalsService.record(body, req.user.id, req.user.role);
  }

  /**
   * GET /api/vitals/patient/:patientId — get latest vitals for a patient.
   * Requires 'vitals.view' permission.
   */
  @Get('patient/:patientId')
  @RequirePermission('vitals.view')
  async getLatest(@Param('patientId') patientId: string): Promise<VitalsResponse | null> {
    return this.vitalsService.getLatestForPatient(patientId);
  }

  /**
   * GET /api/vitals/patient/:patientId/history — get vitals history.
   * Requires 'vitals.view' permission.
   */
  @Get('patient/:patientId/history')
  @RequirePermission('vitals.view')
  async getHistory(
    @Param('patientId') patientId: string,
    @Query('limit') limit?: string,
  ): Promise<VitalsResponse[]> {
    return this.vitalsService.getHistoryForPatient(patientId, limit ? parseInt(limit, 10) : 50);
  }
}
