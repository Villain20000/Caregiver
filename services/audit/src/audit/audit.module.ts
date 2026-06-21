/**
 * services/audit/src/audit/audit.module.ts
 *
 * Feature module that wires the audit microservice's providers.
 *
 * Providers:
 *   - AuditPersistenceService → append-only INSERT writer (audit_log table)
 *   - AuditConsumerService    → Kafka consumer for `audit.event` (lifecycle
 *                               managed via OnApplicationBootstrap/Shutdown)
 *   - AuditQueryService       → read-only retrieval for auditor/medical_director
 *
 * This module is imported by the root AppModule. It does not export anything
 * because the audit service has no inbound HTTP surface — the consumer is
 * started by the bootstrap lifecycle and the query service is consumed
 * internally (the API gateway calls it over Kafka in a fuller deployment).
 */
import { Module } from '@nestjs/common';
import { AuditPersistenceService } from './audit-persistence.service.js';
import { AuditConsumerService } from './audit-consumer.service.js';
import { AuditQueryService } from './audit-query.service.js';

@Module({
  // All three services are singletons scoped to this module. The consumer
  // depends on the persistence service (injected via constructor), so the
  // order here is just declaration order — NestJS resolves the graph.
  providers: [AuditPersistenceService, AuditConsumerService, AuditQueryService],
  // Nothing is exported: the audit service is self-contained. The query
  // service is available to future controllers added within this module.
  exports: [],
})
export class AuditModule {}
