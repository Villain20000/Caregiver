/**
 * services/fhir-ingestion/src/app.module.ts
 *
 * Root NestJS module for the FHIR ingestion microservice.
 *
 * This is a headless microservice — it has no HTTP controllers. Its only
 * entry point is the Kafka consumer subscribed to `fhir.resource.ingested`.
 * The NestJS application context (rather than a full HTTP app) would be
 * sufficient, but we use `NestFactory.create` with the Express platform so
 * a health endpoint can be added later without restructuring.
 *
 * Module graph:
 *   AppModule
 *     └── FhirModule
 *           ├── FhirValidationService
 *           ├── FhirPersistenceService  (depends on DATABASE token)
 *           └── FhirConsumerService      (Kafka consumer/producer)
 */
import { Module } from '@nestjs/common';
import { FhirModule } from './fhir/fhir.module.js';

/**
 * AppModule — the root module imported by `main.ts`.
 *
 * Only FhirModule is wired here; future feature modules (e.g. a health
 * check module, metrics, retries) would be added to the `imports` array.
 */
@Module({
  imports: [FhirModule],
})
export class AppModule {}
