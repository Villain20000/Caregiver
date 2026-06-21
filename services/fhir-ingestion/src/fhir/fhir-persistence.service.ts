/**
 * services/fhir-ingestion/src/fhir/fhir-persistence.service.ts
 *
 * FHIR resource persistence service.
 *
 * Persists validated (and invalid-but-recorded) FHIR resources to the
 * `fhir_resources` table in PostgreSQL via Drizzle ORM. Uses
 * `onConflictDoUpdate` on the unique `fhirId` constraint so that re-delivered
 * or updated resources are upserted rather than rejected — this gives the
 * ingestion pipeline idempotent, at-least-once semantics.
 *
 * The full FHIR JSON is stored in the `resource` JSONB column; the
 * `validation_status` and `validation_errors` columns capture the outcome
 * of the validation step so downstream services and operators can filter
 * on resource quality.
 */
import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Database, schema } from '@caregiver/db';
import type { FhirValidationResult } from './fhir-validation.service.js';

/**
 * Row shape returned after persistence — the minimal fields the consumer
 * needs to populate the `fhir.resource.validated` event payload.
 */
export interface PersistedFhirResource {
  /** The database UUID (primary key). */
  id: string;
  /** The FHIR resource type. */
  resourceType: string;
  /** The FHIR logical ID. */
  fhirId: string;
  /** The validation status stored in the row. */
  validationStatus: string;
}

/**
 * FhirPersistenceService — wraps the Drizzle client for fhir_resources I/O.
 *
 * Injected with a `Database` instance (provided by FhirModule via the
 * `DATABASE` token) so it is trivially testable with a mocked client.
 */
@Injectable()
export class FhirPersistenceService {
  private readonly logger = new Logger('FhirPersistenceService');

  // Drizzle's jsonb columns accept `unknown`; we type the value loosely.
  constructor(private readonly db: Database) {}

  /**
   * Upsert a single validated FHIR resource.
   *
   * If a row with the same `fhirId` already exists it is updated (resource
   * body, validation status, validation errors, and `updatedAt`); otherwise
   * a new row is inserted. The database UUID of the resulting row is returned.
   *
   * @param result - The validation result for the resource to persist.
   * @returns The persisted row's UUID + metadata.
   */
  async upsertResource(result: FhirValidationResult): Promise<PersistedFhirResource> {
    const { resourceType, fhirId, resource, valid, errors } = result;

    // Derive the validation status string stored in the row.
    // 'validated' for clean resources, 'invalid' for those with errors.
    const validationStatus = valid ? 'validated' : 'invalid';

    // Drizzle expects jsonb values as plain JSON-serializable objects.
    // `resource` is already a plain object from the wire; cast through
    // `unknown` to satisfy the jsonb column's loose value type.
    const resourceJson = resource as unknown as Record<string, unknown>;
    const errorsJson = errors.length > 0 ? errors : null;

    // ── Upsert via onConflictDoUpdate on the fhirId unique index ──
    // The `target` must match the unique constraint defined in the schema
    // (fhirResources.fhirId is `.unique()`). On conflict we refresh all
    // mutable columns and bump `updatedAt` to now().
    const inserted = await this.db
      .insert(schema.fhirResources)
      .values({
        resourceType,
        fhirId,
        resource: resourceJson,
        validationStatus,
        validationErrors: errorsJson,
        // createdAt/updatedAt default to now() in the schema for inserts;
        // for updates we set updatedAt explicitly below.
      })
      .onConflictDoUpdate({
        target: schema.fhirResources.fhirId,
        set: {
          // Refresh the resource body in case the upstream system sent a newer version.
          resource: resourceJson,
          resourceType,
          validationStatus,
          validationErrors: errorsJson,
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.fhirResources.id });

    // `returning()` yields an array; with onConflict we always get exactly one row.
    const row = inserted[0];
    if (!row) {
      // Defensive — should never happen with a healthy Postgres connection.
      throw new Error(`Upsert of ${resourceType}/${fhirId} returned no row`);
    }

    this.logger.log(
      `Persisted ${resourceType}/${fhirId} (status=${validationStatus}, dbId=${row.id})`,
    );

    return {
      id: row.id,
      resourceType,
      fhirId,
      validationStatus,
    };
  }

  /**
   * Fetch a single FHIR resource row by its FHIR logical ID.
   *
   * Useful for idempotency checks and debugging. Returns `undefined` when
   * no row exists for the given `fhirId`.
   *
   * @param fhirId - The FHIR logical ID to look up.
   * @returns The matching row, or `undefined`.
   */
  async findByFhirId(fhirId: string): Promise<PersistedFhirResource | undefined> {
    const rows = await this.db
      .select({
        id: schema.fhirResources.id,
        resourceType: schema.fhirResources.resourceType,
        fhirId: schema.fhirResources.fhirId,
        validationStatus: schema.fhirResources.validationStatus,
      })
      .from(schema.fhirResources)
      .where(eq(schema.fhirResources.fhirId, fhirId))
      .limit(1);

    return rows[0];
  }
}
