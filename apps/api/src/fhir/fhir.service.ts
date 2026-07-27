import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, desc, and, like } from 'drizzle-orm';
import { createDb, schema, type Database } from '@caregiver/db';
import { KAFKA_PRODUCER } from '../kafka/kafka.module.js';
import type { TypedProducer } from '@caregiver/kafka';
import type { FhirResourceIngestedPayload } from '@caregiver/contracts';

function validateBundle(bundle: unknown): Array<{ valid: boolean; resourceType: string; fhirId: string; resource: unknown; errors: string[] }> {
  const results: Array<{ valid: boolean; resourceType: string; fhirId: string; resource: unknown; errors: string[] }> = [];
  const b = (bundle ?? {}) as Record<string, unknown>;
  const entries = Array.isArray(b.entry) ? b.entry : [];
  for (const entry of entries) {
    const e = entry as Record<string, unknown> | undefined;
    if (!e?.resource) {
      results.push({ valid: false, resourceType: 'Unknown', fhirId: '', resource: {}, errors: ['Entry has no resource'] });
      continue;
    }
    const r = e.resource as Record<string, unknown>;
    const errors: string[] = [];
    const resourceType = typeof r.resourceType === 'string' ? r.resourceType : '';
    const fhirId = typeof r.id === 'string' ? r.id : '';
    if (!resourceType) errors.push('Missing resourceType');
    if (!fhirId) errors.push('Missing id');
    results.push({ valid: errors.length === 0, resourceType, fhirId, resource: r, errors });
  }
  return results;
}

export interface FhirResourceResponse {
  id: string;
  resourceType: string;
  fhirId: string;
  resource: unknown;
  validationStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface FhirIngestResponse {
  valid: boolean;
  totalResources: number;
  validResources: number;
  invalidResources: number;
  results: Array<{ valid: boolean; resourceType: string; fhirId: string; errors: string[] }>;
}

@Injectable()
export class FhirService {
  private readonly logger = new Logger(FhirService.name);
  private readonly db: Database;

  constructor(@Inject(KAFKA_PRODUCER) private readonly producer: TypedProducer) {
    this.db = createDb();
  }

  async ingestBundle(
    bundle: unknown,
    sourceSystem: string,
    submittedBy?: string,
  ): Promise<FhirIngestResponse> {
    const results = validateBundle(bundle);
    const validCount = results.filter((r) => r.valid).length;

    await this.producer.send<FhirResourceIngestedPayload>('fhir.resource.ingested', {
      bundle,
      sourceSystem,
      submittedBy,
    });

    this.logger.log(
      `Ingested FHIR bundle: ${results.length} resources (${validCount} valid, ${results.length - validCount} invalid)`,
    );

    return {
      valid: results.every((r) => r.valid),
      totalResources: results.length,
      validResources: validCount,
      invalidResources: results.length - validCount,
      results,
    };
  }

  async getResource(resourceType: string, fhirId: string): Promise<FhirResourceResponse | null> {
    const rows = await this.db
      .select()
      .from(schema.fhirResources)
      .where(
        and(
          eq(schema.fhirResources.resourceType, resourceType),
          eq(schema.fhirResources.fhirId, fhirId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      resourceType: row.resourceType,
      fhirId: row.fhirId,
      resource: row.resource,
      validationStatus: row.validationStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async searchResources(
    resourceType?: string,
    search?: string,
    limit = 100,
    offset = 0,
  ): Promise<FhirResourceResponse[]> {
    const conditions = [];
    if (resourceType) {
      conditions.push(eq(schema.fhirResources.resourceType, resourceType));
    }
    if (search) {
      conditions.push(like(schema.fhirResources.fhirId, `%${search}%`));
    }

    const rows = await this.db
      .select()
      .from(schema.fhirResources)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.fhirResources.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.id,
      resourceType: r.resourceType,
      fhirId: r.fhirId,
      resource: r.resource,
      validationStatus: r.validationStatus,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }
}