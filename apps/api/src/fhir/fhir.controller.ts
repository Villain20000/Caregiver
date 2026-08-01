/**
 * apps/api/src/fhir/fhir.controller.ts
 *
 * FHIR controller — REST endpoints for FHIR resource ingestion and search.
 *
 * 📝 NestJS Concepts Demonstrated:
 *   - **@Controller('fhir')** — route prefix for all endpoints
 *   - **@UseGuards(JwtAuthGuard, RbacGuard)** — protect ALL endpoints
 *   - **@RequirePermission('fhir.ingest')** — RBAC feature-level guard
 *   - **@Query()** — extract query string parameters
 *   - **@Param()** — extract route parameters
 *   - **@Post()/@Get()** — HTTP method decorators
 *
 * All endpoints require JWT authentication + RBAC permission check.
 *
 * Endpoints:
 *   POST /api/fhir/ingest          → ingest FHIR bundle (requires 'fhir.ingest')
 *   GET  /api/fhir/resources       → search resources (requires 'fhir.search')
 *   GET  /api/fhir/:type/:id       → get single resource (requires 'fhir.view')
 */
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RbacGuard, RequirePermission } from '../common/rbac.guard.js';
import { FhirService, type FhirIngestResponse, type FhirResourceResponse } from './fhir.service.js';

@Controller('fhir')
@UseGuards(JwtAuthGuard, RbacGuard)
export class FhirController {
  constructor(private readonly fhirService: FhirService) {}

  @Post('ingest')
  @RequirePermission('fhir.ingest')
  async ingest(
    @Body() body: { bundle: unknown; sourceSystem: string; submittedBy?: string },
  ): Promise<FhirIngestResponse> {
    return this.fhirService.ingestBundle(body.bundle, body.sourceSystem, body.submittedBy);
  }

  @Get('resources')
  @RequirePermission('fhir.search')
  async search(
    @Query('resourceType') resourceType?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<FhirResourceResponse[]> {
    return this.fhirService.searchResources(
      resourceType,
      search,
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get(':resourceType/:id')
  @RequirePermission('fhir.view')
  async get(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
  ): Promise<FhirResourceResponse | null> {
    return this.fhirService.getResource(resourceType, id);
  }
}
