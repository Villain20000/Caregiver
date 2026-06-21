/**
 * services/fhir-ingestion/src/fhir/fhir.module.ts
 *
 * FHIR feature module — wires the validation, persistence, and consumer
 * services that make up the ingestion pipeline.
 *
 * Providers:
 *   - `DATABASE` (token) → a Drizzle `Database` instance from @caregiver/db
 *   - FhirValidationService   → stateless structural validator
 *   - FhirPersistenceService  → Drizzle upserts against fhir_resources
 *   - FhirConsumerService     → Kafka consumer/producer orchestrator
 *
 * The `DATABASE` token is used (rather than `@Inject(Database)`) because
 * `Database` is a type alias, not a class — NestJS DI needs a concrete
 * injection token. The factory reads the connection URL from the
 * environment via `createDb()`.
 */
import { Module } from '@nestjs/common';
import { createDb, type Database } from '@caregiver/db';
import { FhirValidationService } from './fhir-validation.service.js';
import { FhirPersistenceService } from './fhir-persistence.service.js';
import {
  FhirConsumerService,
  FHIR_CONSUMER_GROUP_ID,
} from './fhir-consumer.service.js';

/**
 * Injection token for the Drizzle `Database` instance.
 *
 * Using a Symbol keeps the token unique and avoids string collisions.
 */
export const DATABASE = Symbol('DATABASE');

/**
 * Factory: create a Drizzle client bound to the platform schema.
 *
 * The connection URL is resolved from `DATABASE_URL` (or individual
 * `POSTGRES_*` env vars) inside `createDb`.
 */
async function databaseFactory(): Promise<Database> {
  return createDb();
}

/**
 * FhirModule — the single feature module for the fhir-ingestion service.
 *
 * Exported so the root AppModule can import it. All three services are
 * scoped to this module (the consumer is the only one that needs to be
 * instantiated to start the Kafka loop, but NestJS instantiates all
 * providers in the module graph on bootstrap).
 */
@Module({
  providers: [
    // Drizzle client — singleton for the lifetime of the process.
    { provide: DATABASE, useFactory: databaseFactory },
    FhirValidationService,
    FhirPersistenceService,
    // Consumer group id — overridable for tests; defaults are applied in
    // the consumer constructor via the @Inject default.
    { provide: FHIR_CONSUMER_GROUP_ID, useValue: 'caregiver-fhir-ingestion' },
    FhirConsumerService,
  ],
  // FhirConsumerService is not exported — it is started by NestJS lifecycle
  // hooks (OnModuleInit) and not consumed by other modules.
  exports: [FhirValidationService, FhirPersistenceService],
})
export class FhirModule {}
