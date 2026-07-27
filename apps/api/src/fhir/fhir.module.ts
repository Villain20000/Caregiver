import { Module } from '@nestjs/common';
import { FhirController } from './fhir.controller.js';
import { FhirService } from './fhir.service.js';

@Module({
  controllers: [FhirController],
  providers: [FhirService],
})
export class FhirModule {}
