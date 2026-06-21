/**
 * apps/api/src/ai/ai.service.ts
 *
 * AI service — handles AI-assisted diagnosis requests and reviews.
 *
 * When a doctor requests a diagnosis:
 *   1. Persist the request to the ai_diagnoses table (status: 'requested')
 *   2. Emit `ai.diagnosis.requested` Kafka event
 *   3. The ai-rag microservice consumes the event, runs RAG + LLM, and
 *      emits `ai.diagnosis.completed`
 *   4. The frontend receives the result via Socket.io or polling
 *
 * When a doctor reviews a diagnosis (approve/override):
 *   1. Update the ai_diagnoses row (status: 'approved' or 'overridden')
 *   2. Emit `audit.event` for the review action
 */
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createDb, schema, type Database } from '@caregiver/db';
import { KAFKA_PRODUCER } from '../kafka/kafka.module.js';
import type { TypedProducer } from '@caregiver/kafka';
import type {
  RequestDiagnosisRequest,
  ReviewDiagnosisRequest,
  AiDiagnosisResponse,
  AiDiagnosisRequestedPayload,
  AuditEventPayload,
} from '@caregiver/contracts';

@Injectable()
export class AiService {
  private readonly logger = new Logger('AiService');
  private readonly db: Database;

  constructor(@Inject(KAFKA_PRODUCER) private readonly producer: TypedProducer) {
    this.db = createDb();
  }

  /**
   * Request an AI-assisted diagnosis.
   * Creates a DB row and emits a Kafka event for the ai-rag service.
   */
  async requestDiagnosis(
    req: RequestDiagnosisRequest,
    requestedBy: string,
    requestedByRole: string,
  ): Promise<AiDiagnosisResponse> {
    // Insert the diagnosis request into the DB.
    const [diagnosis] = await this.db
      .insert(schema.aiDiagnoses)
      .values({
        patientId: req.patientId,
        requestedBy,
        status: 'requested',
        inputContext: req.inputContext,
      })
      .returning();

    if (!diagnosis) throw new Error('Failed to insert diagnosis request');

    // Emit Kafka event for the ai-rag microservice.
    const payload: AiDiagnosisRequestedPayload = {
      diagnosisId: diagnosis.id,
      patientId: req.patientId,
      requestedBy,
      requestedByRole,
      inputContext: req.inputContext,
      fhirResourceIds: req.fhirResourceIds,
      requestedAt: diagnosis.createdAt.toISOString(),
    };

    await this.producer.send('ai.diagnosis.requested', payload, {
      userId: requestedBy,
      userRole: requestedByRole,
    });

    this.logger.log(`AI diagnosis ${diagnosis.id} requested by ${requestedBy}`);

    return this.toResponse(diagnosis);
  }

  /**
   * Get a diagnosis by ID.
   */
  async getById(id: string): Promise<AiDiagnosisResponse> {
    const [diagnosis] = await this.db
      .select()
      .from(schema.aiDiagnoses)
      .where(eq(schema.aiDiagnoses.id, id))
      .limit(1);

    if (!diagnosis) {
      throw new NotFoundException(`Diagnosis ${id} not found`);
    }

    return this.toResponse(diagnosis);
  }

  /**
   * Review a diagnosis (approve or override).
   * Updates the DB row and emits an audit event.
   */
  async review(
    id: string,
    req: ReviewDiagnosisRequest,
    reviewedBy: string,
    reviewedByRole: string,
  ): Promise<AiDiagnosisResponse> {
    const [current] = await this.db
      .select()
      .from(schema.aiDiagnoses)
      .where(eq(schema.aiDiagnoses.id, id))
      .limit(1);

    if (!current) {
      throw new NotFoundException(`Diagnosis ${id} not found`);
    }

    // Update the diagnosis record.
    const [updated] = await this.db
      .update(schema.aiDiagnoses)
      .set({
        status: req.decision === 'approve' ? 'approved' : 'overridden',
        reviewedBy,
        reviewNotes: req.reviewNotes,
        diagnosis: req.decision === 'override' ? req.overrideDiagnosis : current.diagnosis,
        reviewedAt: new Date(),
      })
      .where(eq(schema.aiDiagnoses.id, id))
      .returning();

    if (!updated) throw new Error('Failed to update diagnosis');

    // Emit audit event.
    const auditPayload: AuditEventPayload = {
      userId: reviewedBy,
      userRole: reviewedByRole,
      action: req.decision === 'approve' ? 'approve' : 'override',
      resourceType: 'AiDiagnosis',
      resourceId: id,
      result: 'success',
      serviceName: 'api-gateway',
      details: { reviewNotes: req.reviewNotes },
      occurredAt: new Date().toISOString(),
    };

    await this.producer.send('audit.event', auditPayload, {
      userId: reviewedBy,
      userRole: reviewedByRole,
    });

    this.logger.log(`Diagnosis ${id} ${req.decision}d by ${reviewedBy}`);

    return this.toResponse(updated);
  }

  /** Map a DB row to the API response DTO. */
  private toResponse(row: typeof schema.aiDiagnoses.$inferSelect): AiDiagnosisResponse {
    return {
      id: row.id,
      patientId: row.patientId,
      requestedBy: row.requestedBy,
      status: row.status,
      diagnosis: row.diagnosis ?? undefined,
      reviewedBy: row.reviewedBy ?? undefined,
      reviewNotes: row.reviewNotes ?? undefined,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString(),
    };
  }
}
