/**
 * services/ai-rag/src/rag/__tests__/rag-pipeline.service.spec.ts
 *
 * Unit tests for RagPipelineService — the RAG orchestration layer.
 *
 * The pipeline is constructed directly with mock collaborators (matching the
 * auth.service.spec.ts pattern — no Nest TestingModule needed since it uses
 * plain constructor DI): mock ChromaService, mock OllamaService, a mock
 * Drizzle Database (chainable update/set/where), and a mock TypedProducer.
 *
 * Key behaviors asserted:
 *   - Happy path: marks processing → retrieves context → builds prompt →
 *     generates → persists completed → emits completed + audit events.
 *   - Failure path: marks failed, emits a failure completed event, and the
 *     audit event records `failure` — and run() NEVER throws to the caller.
 *   - The RAG prompt embeds the system instructions, retrieved context
 *     (with source IDs), and the clinical question.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  AiDiagnosisRequestedPayload,
  AiDiagnosisCompletedPayload,
} from '@caregiver/contracts';
import { RagPipelineService } from '../rag-pipeline.service.js';

// ── Hoisted mocks ─────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const whereMock = vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn(() => ({ where: whereMock }));
  const updateMock = vi.fn(() => ({ set: setMock }));
  return {
    db: { update: updateMock },
    producer: { send: vi.fn().mockResolvedValue([]) },
    chroma: { retrieveContext: vi.fn() },
    ollama: { generate: vi.fn() },
    setMock,
    whereMock,
  };
});

vi.mock('@caregiver/db', () => ({
  createDb: vi.fn(),
  schema: { aiDiagnoses: { id: 'id', status: 'status' } },
}));

// Avoid loading real Kafka / Chroma clients in the test process.
vi.mock('@caregiver/kafka', () => ({
  createProducer: vi.fn(),
  createConsumer: vi.fn(),
}));

vi.mock('chromadb', () => ({
  ChromaClient: vi.fn(),
  IncludeEnum: {},
  OllamaEmbeddingFunction: vi.fn(),
}));

// drizzle-orm `eq` is used only to build a WHERE clause the mock ignores.
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({})) }));

describe('RagPipelineService', () => {
  let service: RagPipelineService;

  const payload: AiDiagnosisRequestedPayload = {
    diagnosisId: 'diag-1',
    patientId: 'patient-42',
    requestedBy: 'doctor-1',
    requestedByRole: 'doctor',
    inputContext: 'Patient reports chest pain for two days.',
    requestedAt: '2024-01-01T00:00:00.000Z',
  };

  const documents = [
    {
      documentId: 'doc-1',
      score: 0.95,
      description: 'Encounter note',
      document: 'Patient complained of intermittent chest pain.',
    },
    {
      documentId: 'doc-2',
      score: 0.8,
      description: 'Lab results',
      document: 'Troponin levels within normal range.',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chroma.retrieveContext.mockResolvedValue(documents);
    mocks.ollama.generate.mockResolvedValue({
      text: 'Likely musculoskeletal chest pain.',
      model: 'llama3:8b',
    });
    service = new RagPipelineService(
      mocks.chroma as never,
      mocks.ollama as never,
      mocks.db as never,
      mocks.producer as never,
    );
  });

  describe('happy path', () => {
    it('runs the full pipeline and emits completed + audit events', async () => {
      await service.run(payload, {
        userId: 'doctor-1',
        correlationId: 'corr-1',
        userRole: 'doctor',
      });

      // Step 1: mark processing.
      expect(mocks.db.update).toHaveBeenCalledWith({ id: 'id', status: 'status' });
      expect(mocks.setMock).toHaveBeenCalledWith({ status: 'processing' });

      // Step 2: retrieve context (query, MAX_CONTEXT_DOCUMENTS=5, patientId).
      expect(mocks.chroma.retrieveContext).toHaveBeenCalledWith(
        payload.inputContext,
        5,
        payload.patientId,
      );

      // Step 3: prompt embeds system instructions + context + question.
      const prompt = mocks.ollama.generate.mock.calls[0]![0] as string;
      expect(prompt).toContain('You are a medical AI assistant');
      expect(prompt).toContain('Patient reports chest pain for two days.');
      expect(prompt).toContain('[Source 1]');
      expect(prompt).toContain('doc-1');
      expect(prompt).toContain('doc-2');

      // Step 4: generate.
      expect(mocks.ollama.generate).toHaveBeenCalledTimes(1);

      // Step 5: persist completed result.
      expect(mocks.setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          diagnosis: 'Likely musculoskeletal chest pain.',
          sourceReferences: [
            { documentId: 'doc-1', score: 0.95, description: 'Encounter note' },
            { documentId: 'doc-2', score: 0.8, description: 'Lab results' },
          ],
        }),
      );
      // The completedAt on the last set call is a Date.
      const completedSetCall = mocks.setMock.mock.calls.find((c) => c[0]?.status === 'completed')!;
      expect(completedSetCall[0].completedAt).toBeInstanceOf(Date);

      // Step 6: completed event.
      const completedCall = mocks.producer.send.mock.calls.find(
        (c) => c[0] === 'ai.diagnosis.completed',
      )!;
      expect(completedCall).toBeDefined();
      const completedPayload = completedCall[1] as AiDiagnosisCompletedPayload;
      expect(completedPayload).toMatchObject({
        diagnosisId: 'diag-1',
        patientId: 'patient-42',
        requestedBy: 'doctor-1',
        diagnosis: 'Likely musculoskeletal chest pain.',
        model: 'llama3:8b',
        success: true,
        sourceReferences: [
          { documentId: 'doc-1', score: 0.95, description: 'Encounter note' },
          { documentId: 'doc-2', score: 0.8, description: 'Lab results' },
        ],
      });
      expect(completedPayload.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(completedCall[2]).toMatchObject({
        correlationId: 'corr-1',
        userId: 'doctor-1',
        userRole: 'doctor',
      });

      // Audit event: diagnose action, success result.
      const auditCall = mocks.producer.send.mock.calls.find((c) => c[0] === 'audit.event')!;
      expect(auditCall).toBeDefined();
      expect(auditCall[1]).toMatchObject({
        userId: 'doctor-1',
        userRole: 'doctor',
        action: 'diagnose',
        resourceType: 'ai_diagnosis',
        resourceId: 'diag-1',
        result: 'success',
        serviceName: 'ai-rag',
        details: { patientId: 'patient-42' },
      });
    });

    it('builds a prompt with a no-context fallback when nothing is retrieved', async () => {
      mocks.chroma.retrieveContext.mockResolvedValueOnce([]);

      await service.run(payload);

      const prompt = mocks.ollama.generate.mock.calls[0]![0] as string;
      expect(prompt).toContain('No relevant clinical context was retrieved.');
      expect(prompt).toContain(payload.inputContext);
    });
  });

  describe('failure path', () => {
    it('marks the diagnosis failed, emits a failure event, and never throws when Ollama fails', async () => {
      mocks.ollama.generate.mockRejectedValueOnce(new Error('Ollama request failed: HTTP 503'));

      await expect(service.run(payload)).resolves.toBeUndefined();

      // Row marked failed.
      expect(mocks.setMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));

      // Failure completed event.
      const completedCall = mocks.producer.send.mock.calls.find(
        (c) => c[0] === 'ai.diagnosis.completed',
      )!;
      const failedPayload = completedCall[1] as AiDiagnosisCompletedPayload;
      expect(failedPayload.success).toBe(false);
      expect(failedPayload.errorMessage).toContain('HTTP 503');
      expect(failedPayload.diagnosis).toBe('');
      expect(failedPayload.sourceReferences).toEqual([]);

      // Audit records the failure.
      const auditCall = mocks.producer.send.mock.calls.find((c) => c[0] === 'audit.event')!;
      expect(auditCall[1]).toMatchObject({
        result: 'failure',
        errorMessage: 'Ollama request failed: HTTP 503',
      });
    });

    it('handles ChromaDB retrieval failures as gracefully as generation failures', async () => {
      mocks.chroma.retrieveContext.mockRejectedValueOnce(new Error('ChromaDB query failed'));

      await expect(service.run(payload)).resolves.toBeUndefined();

      expect(mocks.setMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));

      const completedCall = mocks.producer.send.mock.calls.find(
        (c) => c[0] === 'ai.diagnosis.completed',
      )!;
      const failedPayload = completedCall[1] as AiDiagnosisCompletedPayload;
      expect(failedPayload.success).toBe(false);
      expect(failedPayload.errorMessage).toContain('ChromaDB query failed');
    });

    it('keeps run() from throwing even if the failure DB update itself fails', async () => {
      mocks.ollama.generate.mockRejectedValueOnce(new Error('boom'));
      // The set() calls: first is the `processing` write (succeeds), second is
      // the `failed` write — make its where() reject so handleFailure's
      // best-effort DB update catches its own error and continues.
      mocks.whereMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('db down'));

      await expect(service.run(payload)).resolves.toBeUndefined();

      // Failure event still emitted so the gateway can notify the clinician.
      const completedCall = mocks.producer.send.mock.calls.find(
        (c) => c[0] === 'ai.diagnosis.completed',
      )!;
      expect(completedCall).toBeDefined();
      expect((completedCall[1] as AiDiagnosisCompletedPayload).success).toBe(false);
    });

    it('emits the audit event even when the failure event cannot be produced', async () => {
      mocks.ollama.generate.mockRejectedValueOnce(new Error('boom'));
      // Producer fails for the completed failure event, but not the audit event.
      mocks.producer.send.mockRejectedValueOnce(new Error('kafka down')).mockResolvedValueOnce([]);

      await expect(service.run(payload)).resolves.toBeUndefined();

      // The audit event send attempt happened (best-effort, second send call).
      const auditCalls = mocks.producer.send.mock.calls.filter((c) => c[0] === 'audit.event');
      expect(auditCalls.length).toBeGreaterThan(0);
    });
  });
});
