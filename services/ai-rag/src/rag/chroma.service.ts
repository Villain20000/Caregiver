/**
 * services/ai-rag/src/rag/chroma.service.ts
 *
 * ChromaDB client — the vector store access layer of the RAG pipeline.
 *
 * This is the ONLY component in the platform that talks to ChromaDB. It
 * connects to a ChromaDB server (URL from CHROMA_URL, default
 * http://localhost:8000) and performs semantic similarity search over the
 * embedded FHIR/clinical document collection.
 *
 * Responsibilities:
 *   1. Lazily create/reuse a ChromaClient + collection on module init.
 *   2. Embed the incoming clinical question using Ollama's embedding model
 *      (OllamaEmbeddingFunction) so query embeddings live in the same vector
 *      space as the stored documents.
 *   3. Run a similarity search (`collection.query`) and return the top-K
 *      matching documents with a normalized relevance score.
 *
 * The returned `RetrievedDocument` list feeds the prompt builder in the
 * RAG pipeline service and is also serialized into `sourceReferences` on
 * the `ai.diagnosis.completed` event for clinician traceability.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChromaClient, IncludeEnum, OllamaEmbeddingFunction, type Collection } from 'chromadb';

/**
 * A single retrieved clinical document with its relevance score.
 * This shape is the bridge between the vector store and both the LLM
 * prompt and the `sourceReferences` field of the completed event.
 */
export interface RetrievedDocument {
  /** ChromaDB document ID (stable identifier of the embedded chunk). */
  documentId: string;
  /** Normalized relevance score in the range [0, 1] (1 = exact match). */
  score: number;
  /** Human-readable description of the source (from document metadata). */
  description: string;
  /** The raw document text retrieved from the vector store. */
  document: string;
}

/**
 * Default ChromaDB server URL used when CHROMA_URL is not set.
 * Matches the docker-compose service definition.
 */
const DEFAULT_CHROMA_URL = 'http://localhost:8000';

/**
 * Default Ollama URL used for the embedding function when OLLAMA_URL is
 * not set. Kept in sync with the Ollama service default.
 */
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/**
 * Default embedding model. A dedicated sentence-embedding model is preferred
 * over the generative LLM for retrieval quality; override via
 * OLLAMA_EMBEDDING_MODEL if a different model is pulled in Ollama.
 */
const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text';

/**
 * Name of the ChromaDB collection that holds embedded clinical/FHIR documents.
 * The fhir-ingestion pipeline is responsible for populating this collection;
 * ai-rag only reads from it.
 */
const CLINICAL_COLLECTION = 'caregiver_clinical';

/**
 * ChromaDB access service.
 *
 * Exposes a single `retrieveContext` method that wraps similarity search and
 * normalizes ChromaDB's distance metric into a 0–1 relevance score.
 */
@Injectable()
export class ChromaService implements OnModuleInit {
  private readonly logger = new Logger('ChromaService');

  /** ChromaDB client (created on init). */
  private client!: ChromaClient;

  /** Cached clinical collection handle (created/reused on init). */
  private collection: Collection | null = null;

  /**
   * Initialize the ChromaDB client and resolve the clinical collection.
   *
   * Connection failures are logged but NOT thrown — the service stays up so
   * the RAG pipeline can degrade gracefully (mark diagnoses as `failed`)
   * rather than crashing the whole microservice on startup.
   */
  async onModuleInit(): Promise<void> {
    const chromaUrl = process.env.CHROMA_URL ?? DEFAULT_CHROMA_URL;
    this.logger.log(`Connecting to ChromaDB at ${chromaUrl}`);

    this.client = new ChromaClient({ path: chromaUrl });

    // Use Ollama for embeddings so query vectors share the embedding space
    // with the stored documents (which were embedded by the same model).
    const embeddingFunction = new OllamaEmbeddingFunction({
      url: process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL,
      model: process.env.OLLAMA_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL,
    });

    try {
      // getOrCreateCollection is idempotent — safe whether the collection
      // already exists (populated by fhir-ingestion) or not.
      this.collection = await this.client.getOrCreateCollection({
        name: CLINICAL_COLLECTION,
        embeddingFunction,
      });
      this.logger.log(`ChromaDB collection '${CLINICAL_COLLECTION}' ready.`);
    } catch (error) {
      // Degrade gracefully: retrieveContext will short-circuit when the
      // collection is unavailable.
      this.logger.error(
        `Failed to connect to ChromaDB collection '${CLINICAL_COLLECTION}': ${this.errorMessage(error)}`,
      );
      this.collection = null;
    }
  }

  /**
   * Retrieve the top-K clinically relevant documents for a query.
   *
   * @param query - The clinical question / context to search for.
   * @param nResults - Maximum number of documents to return (default 5).
   * @param patientId - Optional patient UUID used to filter the collection
   *                     via metadata so only that patient's documents are
   *                     considered (privacy + relevance scoping).
   * @returns Array of retrieved documents, sorted by descending relevance.
   *           Returns an empty array if ChromaDB is unavailable.
   */
  async retrieveContext(
    query: string,
    nResults = 5,
    patientId?: string,
  ): Promise<RetrievedDocument[]> {
    if (!this.collection) {
      this.logger.warn('ChromaDB collection unavailable — returning no context.');
      return [];
    }

    try {
      // `where` filters by metadata. When a patientId is supplied we restrict
      // to documents tagged with that patient so the LLM only sees the
      // relevant patient's clinical history (HIPAA minimum-necessary).
      const where = patientId ? { patientId } : undefined;

      const result = await this.collection.query({
        queryTexts: query,
        nResults,
        where,
        // We need documents + metadata + distances to build the response.
        // IncludeEnum is a runtime enum (not string literals) so we use the
        // enum members to satisfy the chromadb type contract.
        include: [IncludeEnum.Documents, IncludeEnum.Metadatas, IncludeEnum.Distances],
      });

      return this.normalizeResults(result);
    } catch (error) {
      this.logger.error(
        `ChromaDB query failed: ${this.errorMessage(error)}`,
      );
      return [];
    }
  }

  /**
   * Convert a ChromaDB `MultiQueryResponse` (one query → arrays of arrays)
   * into the flat `RetrievedDocument[]` shape the pipeline expects.
   *
   * ChromaDB returns distances (lower = more similar for the default L2
   * metric). We normalize to a 0–1 relevance score via `1 / (1 + distance)`,
   * which maps distance 0 → score 1 and decays monotonically.
   */
  private normalizeResults(
    result: Awaited<ReturnType<Collection['query']>>,
  ): RetrievedDocument[] {
    // query() always returns MultiQueryResponse (array-of-arrays) even for a
    // single query text — take the first (and only) result group.
    const groupIndex = 0;
    const ids = result.ids[groupIndex] ?? [];
    const documents = result.documents[groupIndex] ?? [];
    const metadatas = result.metadatas[groupIndex] ?? [];
    const distances = result.distances?.[groupIndex] ?? [];

    const docs: RetrievedDocument[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i] ?? '';
      const document = documents[i] ?? '';
      const metadata = metadatas[i] ?? {};
      const distance = distances[i] ?? 0;

      // Normalize L2 distance → [0,1] relevance score.
      const score = distance === 0 ? 1 : 1 / (1 + distance);

      // Prefer an explicit `description` metadata field; fall back to a
      // truncated snippet of the document text for human readability.
      const description =
        (typeof metadata === 'object' && metadata !== null
          ? String(
              (metadata as Record<string, unknown>).description ?? '',
            )
          : '') || document.slice(0, 120);

      docs.push({ documentId: id, score, description, document });
    }

    // Sort by descending relevance (highest score first).
    return docs.sort((a, b) => b.score - a.score);
  }

  /**
   * Coerce an unknown error into a single-line message for logging.
   * Avoids `[object Object]` when the caught value is not an Error.
   */
  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
