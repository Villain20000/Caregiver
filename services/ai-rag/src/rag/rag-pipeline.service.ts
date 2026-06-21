/**
 * services/ai-rag/src/rag/rag-pipeline.service.ts
 *
 * RAG pipeline orchestrator — the heart of the AI/RAG microservice.
 *
 * Given an `ai.diagnosis.requested` payload, it runs the full
 * Retrieval-Augmented Generation flow:
 *
 *   1. Mark the diagnosis row as `processing` in Postgres (ai_diagnoses).
 *   2. Retrieve relevant clinical context from ChromaDB (similarity search).
 *   3. Build the RAG prompt: system instructions + retrieved context +
 *      the clinician's question.
 *   4. Call Ollama (Llama-3-8B) to generate the diagnosis.
 *   5. Persist the result (diagnosis text + source references) to Postgres
 *      and mark the row `completed`.
 *   6. Emit `ai.diagnosis.completed` so the API gateway can notify the
 *      requesting clinician, plus an `audit.event` for traceability.
 *
 * Error handling: if ChromaDB or Ollama is unavailable (or any step throws),
 * the diagnosis row is marked `failed`, and a `completed` event with
 * `success: false` is still emitted so the gateway can surface the failure
 * to the clinician rather than hanging indefinitely.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '@caregiver/db';
import { schema } from '@caregiver/db';
import type { TypedProducer } from '@caregiver/kafka';
import type {
  AiDiagnosisCompletedPayload,
  AiDiagnosisRequestedPayload,
  AuditEventPayload,
} from '@caregiver/contracts';
import { ChromaService, type RetrievedDocument } from './chroma.service.js';
import { OllamaService } from './ollama.service.js';
import { DATABASE, KAFKA_PRODUCER } from './rag.module.js';

/**
 * System prompt framing the LLM as a medical AI assistant.
 * This is prepended to every generation request to set behavior and guard
 * against hallucination outside the retrieved context.
 */
const SYSTEM_PROMPT = `You are a medical AI assistant supporting clinicians on the Caregiver platform.
Use ONLY the provided clinical context to inform your answer.
If the context is insufficient to answer confidently, state that explicitly.
Cite the source documents you relied on by their document ID.
Keep the response concise, structured, and clinically relevant.
Always include a disclaimer that this is AI-assisted and requires clinician review.`;

/**
 * Maximum number of context documents to retrieve from ChromaDB per request.
 * Keeps the prompt within the model's context window and bounds latency.
 */
const MAX_CONTEXT_DOCUMENTS = 5;

/**
 * RAG pipeline service — orchestrates retrieval → prompt → generation →
 * persistence → event emission for a single diagnosis request.
 */
@Injectable()
export class RagPipelineService {
  private readonly logger = new Logger('RagPipeline');

  constructor(
    private readonly chroma: ChromaService,
    private readonly ollama: OllamaService,
    @Inject(DATABASE) private readonly db: Database,
    @Inject(KAFKA_PRODUCER) private readonly producer: TypedProducer,
  ) {}

  /**
   * Run the full RAG pipeline for one diagnosis request.
   *
   * This method never throws to the caller — all failures are captured and
   * reflected into the diagnosis row (`failed`) and the completed event
   * (`success: false`) so the upstream consumer loop stays healthy.
   *
   * @param payload - The `ai.diagnosis.requested` event payload.
   * @param envelopeMeta - Optional envelope metadata (userId, correlationId)
   *                        forwarded from the consumed event for tracing.
   */
  async run(
    payload: AiDiagnosisRequestedPayload,
    envelopeMeta?: { userId?: string; correlationId?: string; userRole?: string },
  ): Promise<void> {
    const startTime = Date.now();
    const { diagnosisId, patientId, requestedBy, inputContext } = payload;

    this.logger.log(`Processing diagnosis ${diagnosisId} for patient ${patientId}`);

    try {
      // ── Step 1: mark as processing ───────────────────────────────
      await this.db
        .update(schema.aiDiagnoses)
        .set({ status: 'processing' })
        .where(eq(schema.aiDiagnoses.id, diagnosisId));

      // ── Step 2: retrieve relevant context from ChromaDB ──────────
      const documents = await this.chroma.retrieveContext(
        inputContext,
        MAX_CONTEXT_DOCUMENTS,
        patientId,
      );

      // ── Step 3: build the RAG prompt ─────────────────────────────
      const prompt = this.buildPrompt(inputContext, documents);

      // ── Step 4: generate via Ollama ──────────────────────────────
      const { text, model } = await this.ollama.generate(prompt);

      const processingTimeMs = Date.now() - startTime;
      const completedAt = new Date().toISOString();

      // Source references for the event + DB (documentId, score, description).
      const sourceReferences = documents.map((d) => ({
        documentId: d.documentId,
        score: d.score,
        description: d.description,
      }));

      // ── Step 5: persist result + mark completed ──────────────────
      await this.db
        .update(schema.aiDiagnoses)
        .set({
          status: 'completed',
          diagnosis: text,
          // jsonb column — store the structured references array.
          sourceReferences,
          completedAt: new Date(),
        })
        .where(eq(schema.aiDiagnoses.id, diagnosisId));

      // ── Step 6: emit completed + audit events ────────────────────
      const completedPayload: AiDiagnosisCompletedPayload = {
        diagnosisId,
        patientId,
        requestedBy,
        diagnosis: text,
        sourceReferences,
        model,
        processingTimeMs,
        success: true,
        completedAt,
      };

      await this.producer.send('ai.diagnosis.completed', completedPayload, {
        correlationId: envelopeMeta?.correlationId,
        userId: requestedBy,
        userRole: envelopeMeta?.userRole ?? payload.requestedByRole,
      });

      await this.emitAuditEvent(payload, 'success');

      this.logger.log(
        `Diagnosis ${diagnosisId} completed in ${processingTimeMs}ms (model=${model}).`,
      );
    } catch (error) {
      // Any failure → mark failed and emit a failure completed event so the
      // gateway can surface it to the clinician.
      const errorMessage = this.errorMessage(error);
      this.logger.error(
        `Diagnosis ${diagnosisId} failed: ${errorMessage}`,
      );

      await this.handleFailure(payload, errorMessage, startTime, envelopeMeta);
    }
  }

  /**
   * Build the full RAG prompt from the system instructions, retrieved
   * context, and the clinician's clinical question.
   */
  private buildPrompt(
    clinicalQuestion: string,
    documents: RetrievedDocument[],
  ): string {
    // Format each retrieved document with its ID so the model can cite it.
    const contextBlock =
      documents.length > 0
        ? documents
            .map(
              (d, i) =>
                `[Source ${i + 1}] (id: ${d.documentId}, score: ${d.score.toFixed(2)})\n${d.document}`,
            )
            .join('\n\n')
        : 'No relevant clinical context was retrieved.';

    return `${SYSTEM_PROMPT}

## Retrieved Clinical Context
${contextBlock}

## Clinical Question
${clinicalQuestion}

## Response
Provide a structured, evidence-grounded diagnosis below:`;
  }

  /**
   * Handle a pipeline failure: mark the row `failed`, emit a `completed`
   * event with `success: false`, and record an audit event.
   */
  private async handleFailure(
    payload: AiDiagnosisRequestedPayload,
    errorMessage: string,
    startTime: number,
    envelopeMeta?: { userId?: string; correlationId?: string; userRole?: string },
  ): Promise<void> {
    const { diagnosisId, patientId, requestedBy } = payload;
    const completedAt = new Date().toISOString();

    // Best-effort DB update — don't let a DB failure mask the original error.
    try {
      await this.db
        .update(schema.aiDiagnoses)
        .set({ status: 'failed', completedAt: new Date() })
        .where(eq(schema.aiDiagnoses.id, diagnosisId));
    } catch (dbError) {
      this.logger.error(
        `Failed to mark diagnosis ${diagnosisId} as failed in DB: ${this.errorMessage(dbError)}`,
      );
    }

    // Emit a failure completed event so the gateway can notify the clinician.
    const failedPayload: AiDiagnosisCompletedPayload = {
      diagnosisId,
      patientId,
      requestedBy,
      diagnosis: '',
      sourceReferences: [],
      model: process.env.OLLAMA_MODEL ?? 'llama3:8b',
      processingTimeMs: Date.now() - startTime,
      success: false,
      errorMessage,
      completedAt,
    };

    try {
      await this.producer.send('ai.diagnosis.completed', failedPayload, {
        correlationId: envelopeMeta?.correlationId,
        userId: requestedBy,
        userRole: envelopeMeta?.userRole ?? payload.requestedByRole,
      });
    } catch (produceError) {
      this.logger.error(
        `Failed to emit failure event for diagnosis ${diagnosisId}: ${this.errorMessage(produceError)}`,
      );
    }

    await this.emitAuditEvent(payload, 'failure', errorMessage);
  }

  /**
   * Emit an `audit.event` for traceability of the diagnosis action.
   */
  private async emitAuditEvent(
    payload: AiDiagnosisRequestedPayload,
    result: 'success' | 'failure',
    errorMessage?: string,
  ): Promise<void> {
    const auditPayload: AuditEventPayload = {
      userId: payload.requestedBy,
      userRole: payload.requestedByRole,
      action: 'diagnose',
      resourceType: 'ai_diagnosis',
      resourceId: payload.diagnosisId,
      result,
      errorMessage,
      serviceName: 'ai-rag',
      details: { patientId: payload.patientId },
      occurredAt: new Date().toISOString(),
    };

    try {
      await this.producer.send('audit.event', auditPayload);
    } catch (error) {
      // Audit is best-effort — never let it mask the primary flow.
      this.logger.error(
        `Failed to emit audit event for diagnosis ${payload.diagnosisId}: ${this.errorMessage(error)}`,
      );
    }
  }

  /**
   * Coerce an unknown error into a single-line message for logging/events.
   */
  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
