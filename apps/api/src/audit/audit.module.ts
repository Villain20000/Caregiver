/**
 * apps/api/src/audit/audit.module.ts
 *
 * Audit module — provides REST endpoints for querying the audit log.
 *
 * 📝 NestJS Concepts Demonstrated:
 *   - Feature module for read-only audit log access
 *   - Controller handles query parameters for filtering
 *   - Service performs read-only Drizzle queries (never mutates)
 *
 * Note: The actual audit persistence happens in the audit microservice,
 * which is a separate headless NestJS app consuming Kafka events.
 */
import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';

@Module({
  controllers: [AuditController],
  providers: [AuditService],
})
export class AuditModule {}
