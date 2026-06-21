/**
 * services/audit/src/app.module.ts
 *
 * Root NestJS module for the audit microservice.
 *
 * Wires the single feature module — AuditModule — which bundles the
 * append-only persistence writer, the Kafka consumer, and the read-only
 * query service.
 *
 * Unlike the API gateway, this service has no inbound HTTP controllers: it
 * is a pure Kafka consumer that writes to the audit_log table. Express is
 * still used as the underlying NestJS platform (per monorepo convention),
 * but no routes are registered.
 */
import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module.js';

@Module({
  // The audit feature module owns all audit-log providers.
  imports: [AuditModule],
})
export class AppModule {}
