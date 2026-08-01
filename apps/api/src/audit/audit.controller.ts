/**
 * apps/api/src/audit/audit.controller.ts
 *
 * Audit controller — REST endpoints for querying the audit trail.
 *
 * 📝 NestJS Concepts Demonstrated:
 *   - **@Controller('audit')** — route prefix /api/audit
 *   - **@UseGuards(JwtAuthGuard, RbacGuard)** — class-level auth
 *   - **@RequirePermission('audit.read_log')** — all endpoints require audit access
 *   - **@Query()** — query params for pagination
 *   - **@Param()** — route params for user/resource filtering
 *
 * Endpoints:
 *   GET /api/audit                     → list all audit logs (paginated)
 *   GET /api/audit/user/:userId        → filter by user
 *   GET /api/audit/resource/:type/:id  → filter by FHIR resource
 *
 * All endpoints are READ-ONLY. Audit trail is append-only; writes
 * happen only through the audit microservice consuming Kafka events.
 */
import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RbacGuard, RequirePermission } from '../common/rbac.guard.js';
import { AuditService, type AuditLogEntry } from './audit.service.js';

@Controller('audit')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermission('audit.read_log')
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<AuditLogEntry[]> {
    return this.auditService.findAll(
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('user/:userId')
  @RequirePermission('audit.read_log')
  async byUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ): Promise<AuditLogEntry[]> {
    return this.auditService.getByUser(userId, limit ? parseInt(limit, 10) : 100);
  }

  @Get('resource/:resourceType/:resourceId')
  @RequirePermission('audit.read_log')
  async byResource(
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
    @Query('limit') limit?: string,
  ): Promise<AuditLogEntry[]> {
    return this.auditService.getByResource(
      resourceType,
      resourceId,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  /**
   * GET /api/audit/export — export audit logs as CSV.
   * Requires 'audit.export_log' permission.
   */
  @Get('export')
  @RequirePermission('audit.export_log')
  async export(
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('limit') limit?: string,
  ): Promise<void> {
    let logs: AuditLogEntry[];

    if (userId) {
      logs = await this.auditService.getByUser(userId, limit ? parseInt(limit, 10) : 10000);
    } else if (resourceType && resourceId) {
      logs = await this.auditService.getByResource(
        resourceType,
        resourceId,
        limit ? parseInt(limit, 10) : 10000,
      );
    } else {
      logs = await this.auditService.findAll(limit ? parseInt(limit, 10) : 10000, 0);
    }

    // Build CSV
    const headers = [
      'ID',
      'Time',
      'Action',
      'User ID',
      'User Role',
      'Resource Type',
      'Resource ID',
      'Result',
      'Service',
      'Details',
    ];
    const rows = logs.map((log) => [
      log.id,
      log.occurredAt,
      log.action,
      log.userId ?? '',
      log.userRole ?? '',
      log.resourceType ?? '',
      log.resourceId ?? '',
      log.result,
      log.serviceName,
      log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.csv"`,
    );
    res.send(csv);
  }
}
