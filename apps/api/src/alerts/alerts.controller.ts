/**
 * apps/api/src/alerts/alerts.controller.ts
 *
 * Alerts controller — REST endpoints for alert state reporting (the
 * compliance/audit read surface).
 *
 * 📝 NestJS Concepts Demonstrated:
 *   - **@Controller('alerts')** — route prefix /api/alerts
 *   - **@UseGuards(JwtAuthGuard, RbacGuard)** — class-level auth + RBAC
 *   - **@RequirePermission('audit.read_log')** — all endpoints require the
 *     audit-log permission (auditors, medical directors, clinicians, admin)
 *   - **@Query()** — filter/pagination query params (bound to the DTO shape)
 *   - **@Param()** — route params for per-patient queries
 *
 * Endpoints (all READ-ONLY — alert writes happen in the notifications
 * microservice and via the Socket.io gateway's ack handler):
 *   GET /api/alerts                     → search alerts (filters + pagination)
 *   GET /api/alerts/patient/:patientId  → per-patient alert lifecycle state
 *   GET /api/alerts/summary             → compliance summary counts/rates
 */
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RbacGuard, RequirePermission } from '../common/rbac.guard.js';
import { AlertQueryService } from './alert-query.service.js';
import type { AlertStateQuery, AlertStateResponse, AlertStateSummary } from '@caregiver/contracts';

@Controller('alerts')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AlertsController {
  constructor(private readonly alertQueryService: AlertQueryService) {}

  /**
   * GET /api/alerts — filtered search across all alerts.
   * Query params mirror AlertStateQuery (patientId, severity, acknowledged,
   * escalated, from, to, limit, offset).
   */
  @Get()
  @RequirePermission('audit.read_log')
  async list(@Query() query: AlertStateQuery = {}): Promise<AlertStateResponse[]> {
    return this.alertQueryService.findAll(query);
  }

  /**
   * GET /api/alerts/patient/:patientId — full acknowledgment + escalation
   * state for every alert about one patient, newest first.
   */
  @Get('patient/:patientId')
  @RequirePermission('audit.read_log')
  async byPatient(
    @Param('patientId') patientId: string,
    @Query() query: AlertStateQuery = {},
  ): Promise<AlertStateResponse[]> {
    return this.alertQueryService.findByPatient(patientId, query);
  }

  /**
   * GET /api/alerts/summary — aggregate ack/escalation counts + rates for
   * compliance review. Pass patientId to scope it to one patient.
   */
  @Get('summary')
  @RequirePermission('audit.read_log')
  async summary(@Query() query: AlertStateQuery = {}): Promise<AlertStateSummary> {
    return this.alertQueryService.summary(query);
  }
}
