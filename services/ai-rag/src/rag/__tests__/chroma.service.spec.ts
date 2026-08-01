/**
 * services/ai-rag/src/rag/__tests__/chroma.service.spec.ts
 *
 * Unit tests for ChromaService — the ChromaDB vector-store access layer.
 *
 * The `chromadb` module is mocked so no ChromaDB server is contacted. The
 * mock client exposes `getOrCreateCollection` (used by onModuleInit) and the
 * mock collection exposes `query` (used by retrieveContext).
 *
 * The distance → relevance score normalization is asserted directly: the
 * service converts L2 distance into a 0–1 score via `1 / (1 + distance)`
 * (distance 0 → score 1) and sorts results by descending relevance.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChromaService, type RetrievedDocument } from '../chroma.service.js';

// ── Hoisted mocks ─────────────────────────────────────────────────────
// vi.hoisted() runs before the vi.mock() factories, so the mock client /
// collection can be referenced inside the module factory below.
const mocks = vi.hoisted(() => {
  const mockCollection = { query: vi.fn() };
  const mockClient = {
    getOrCreateCollection: vi.fn().mockResolvedValue(mockCollection),
  };
  return {
    mockCollection,
    mockClient,
    MockChromaClient: vi.fn(() => mockClient),
    MockOllamaEmbeddingFunction: vi.fn(),
  };
});

vi.mock('chromadb', () => ({
  ChromaClient: mocks.MockChromaClient,
  IncludeEnum: {
    Documents: 'documents',
    Metadatas: 'metadatas',
    Distances: 'distances',
  },
  OllamaEmbeddingFunction: mocks.MockOllamaEmbeddingFunction,
}));

describe('ChromaService', () => {
  let service: ChromaService;

  beforeEach(() => {
    delete process.env.CHROMA_URL;
    delete process.env.OLLAMA_URL;
    delete process.env.OLLAMA_EMBEDDING_MODEL;
    vi.clearAllMocks();
    service = new ChromaService();
  });

  describe('onModuleInit()', () => {
    it('creates a ChromaClient and resolves the clinical collection', async () => {
      await service.onModuleInit();

      expect(mocks.MockChromaClient).toHaveBeenCalledWith({
        path: 'http://localhost:8000',
      });
      expect(mocks.MockOllamaEmbeddingFunction).toHaveBeenCalledWith({
        url: 'http://localhost:11434',
        model: 'nomic-embed-text',
      });
      expect(mocks.mockClient.getOrCreateCollection).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'caregiver_clinical' }),
      );
    });

    it('honors CHROMA_URL / OLLAMA_URL / OLLAMA_EMBEDDING_MODEL env vars', async () => {
      process.env.CHROMA_URL = 'http://chroma.internal:8001';
      process.env.OLLAMA_URL = 'http://ollama.internal:11435';
      process.env.OLLAMA_EMBEDDING_MODEL = 'snowflake-arctic-embed';

      await service.onModuleInit();

      expect(mocks.MockChromaClient).toHaveBeenCalledWith({
        path: 'http://chroma.internal:8001',
      });
      expect(mocks.MockOllamaEmbeddingFunction).toHaveBeenCalledWith({
        url: 'http://ollama.internal:11435',
        model: 'snowflake-arctic-embed',
      });
    });

    it('degrades gracefully when the collection cannot be resolved', async () => {
      mocks.mockClient.getOrCreateCollection.mockRejectedValueOnce(new Error('connection refused'));

      // Must NOT throw — the service stays up so the pipeline can degrade.
      await expect(service.onModuleInit()).resolves.toBeUndefined();

      // retrieveContext short-circuits with no context.
      const result = await service.retrieveContext('q');
      expect(result).toEqual([]);
      expect(mocks.mockCollection.query).not.toHaveBeenCalled();
    });
  });

  describe('retrieveContext()', () => {
    /** Wire up the mocked collection and run onModuleInit. */
    const init = async (): Promise<void> => {
      await service.onModuleInit();
    };

    it('queries the collection with query, nResults, patient filter, and includes', async () => {
      mocks.mockCollection.query.mockResolvedValue({
        ids: [['doc-1']],
        documents: [['Full clinical text']],
        metadatas: [[{ description: 'Encounter note' }]],
        distances: [[0]],
      });

      await init();
      const result = await service.retrieveContext('chest pain', 3, 'patient-42');

      expect(mocks.mockCollection.query).toHaveBeenCalledWith({
        queryTexts: 'chest pain',
        nResults: 3,
        where: { patientId: 'patient-42' },
        include: ['documents', 'metadatas', 'distances'],
      });

      expect(result).toEqual([
        {
          documentId: 'doc-1',
          score: 1,
          description: 'Encounter note',
          document: 'Full clinical text',
        },
      ]);
    });

    it('omits the patient filter when patientId is not provided', async () => {
      mocks.mockCollection.query.mockResolvedValue({
        ids: [['doc-1']],
        documents: [['text']],
        metadatas: [[null]],
        distances: [[1]],
      });

      await init();
      await service.retrieveContext('q');

      const queryArg = mocks.mockCollection.query.mock.calls[0]![0];
      expect(queryArg.where).toBeUndefined();
      expect(queryArg.queryTexts).toBe('q');
    });

    it('normalizes distances into 0–1 scores, sorts descending, and falls back to a snippet for description', async () => {
      mocks.mockCollection.query.mockResolvedValue({
        ids: [['doc-far', 'doc-near']],
        documents: [['A long clinical note without a description', 'Near match text']],
        metadatas: [[null, { description: 'Lab results' }]],
        // distance 3 → score 0.25; distance 0 → score 1.
        distances: [[3, 0]],
      });

      await init();
      const result = await service.retrieveContext('q');

      // Sorted by descending score: near match (1) first, far (0.25) second.
      expect(result.map((d: RetrievedDocument) => d.documentId)).toEqual(['doc-near', 'doc-far']);
      expect(result[0]!.score).toBe(1);
      expect(result[0]!.description).toBe('Lab results');
      // Fallback: first 120 chars of the document text.
      expect(result[1]!.score).toBe(0.25);
      expect(result[1]!.description).toBe('A long clinical note without a description');
    });

    it('returns an empty array when the query throws', async () => {
      mocks.mockCollection.query.mockRejectedValueOnce(new Error('boom'));

      await init();
      const result = await service.retrieveContext('q');

      expect(result).toEqual([]);
    });
  });
});
