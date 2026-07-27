import { Injectable, Logger } from '@nestjs/common';
import { eq, desc, and } from 'drizzle-orm';
import { createDb, schema, type Database } from '@caregiver/db';

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userRole: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  result: string;
  errorMessage: string | null;
  sourceIp: string | null;
  serviceName: string;
  details: Record<string, unknown> | null;
  occurredAt: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly db: Database;

  constructor() {
    this.db = createDb();
  }

  async findAll(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
    const results = await this.db
      .select()
      .from(schema.auditLog)
      .orderBy(desc(schema.auditLog.occurredAt))
      .limit(limit)
      .offset(offset);
    return results.map((r: typeof schema.auditLog.$inferSelect) => this.toEntry(r));
  }

  async getByUser(userId: string, limit = 100): Promise<AuditLogEntry[]> {
    const results = await this.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.userId, userId))
      .orderBy(desc(schema.auditLog.occurredAt))
      .limit(limit);
    return results.map((r: typeof schema.auditLog.$inferSelect) => this.toEntry(r));
  }

  async getByResource(resourceType: string, resourceId: string, limit = 100): Promise<AuditLogEntry[]> {
    const results = await this.db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.resourceType, resourceType), eq(schema.auditLog.resourceId, resourceId)))
      .orderBy(desc(schema.auditLog.occurredAt))
      .limit(limit);
    return results.map((r: typeof schema.auditLog.$inferSelect) => this.toEntry(r));
  }

  private toEntry(row: typeof schema.auditLog.$inferSelect): AuditLogEntry {
    return {
      id: row.id,
      userId: row.userId ?? null,
      userRole: row.userRole ?? null,
      action: row.action,
      resourceType: row.resourceType ?? null,
      resourceId: row.resourceId ?? null,
      result: row.result,
      errorMessage: row.errorMessage ?? null,
      sourceIp: row.sourceIp ?? null,
      serviceName: row.serviceName,
      details: row.details as Record<string, unknown> | null,
      occurredAt: row.occurredAt.toISOString(),
    };
  }
}