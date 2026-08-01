/**
 * apps/api/src/fhir/fhir.module.ts
 *
 * FHIR module — bundles the FHIR controller and service.
 *
 * 📝 NestJS Concepts Demonstrated:
 *   - **@Module()** decorator to declare controllers and providers
 *   - Feature module that registers routes + injectable services
 *   - No imports needed — FhirService dependencies are provided globally
 *     (KafkaModule is @Global())
 *
 * Endpoints registered by this module are prefixed with /api/fhir
 * (global prefix set in main.ts, @Controller('fhir') in controller).
 */
import { Module } from '@nestjs/common';
import { FhirController } from './fhir.controller.js';
import { FhirService } from './fhir.service.js';

@Module({
  controllers: [FhirController],
  providers: [FhirService],
})
export class FhirModule {}
