import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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
    return this.auditService.getByResource(resourceType, resourceId, limit ? parseInt(limit, 10) : 100);
  }
}