/**
 * services/ai-rag/src/rag/ollama.service.ts
 *
 * Ollama client — the local LLM inference layer of the RAG pipeline.
 *
 * This is the ONLY component in the platform that talks to Ollama. It calls
 * the local Ollama REST API (OLLAMA_URL, default http://localhost:11434)
 * to generate diagnoses with the `llama3:8b` model.
 *
 * Implementation note: we use the native `fetch` API (built into Node 20)
 * and POST to Ollama's `/api/generate` endpoint with `stream: false` so we
 * get the full response in a single JSON body — no SSE parsing required.
 * This keeps the dependency surface minimal (no `ollama` SDK needed here).
 */
import { Injectable, Logger } from '@nestjs/common';

/**
 * Default Ollama server URL used when OLLAMA_URL is not set.
 * Matches the docker-compose service definition.
 */
const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/**
 * Default generative model. Llama-3 8B is the platform's chosen local model
 * for AI-assisted diagnosis. Override via OLLAMA_MODEL if a different model
 * is pulled in Ollama.
 */
const DEFAULT_OLLAMA_MODEL = 'llama3:8b';

/**
 * Shape of Ollama's `/api/generate` response body (non-streaming).
 * Only the fields we consume are declared; Ollama returns more.
 */
interface OllamaGenerateResponse {
  /** The generated text (the model's completion of the prompt). */
  response: string;
  /** Whether generation completed (true) or was aborted (false). */
  done: boolean;
  /** Total generation time in nanoseconds (when done). */
  total_duration?: number;
  /** Error message if Ollama reported an error inline. */
  error?: string;
}

/**
 * Result of a generation call — the text plus the model identifier used,
 * so the pipeline can record which model produced a given diagnosis.
 */
export interface OllamaGenerationResult {
  /** The generated diagnosis text. */
  text: string;
  /** The model that produced the text (e.g. 'llama3:8b'). */
  model: string;
}

/**
 * Ollama inference service.
 *
 * Exposes a single `generate` method that builds the prompt (system +
 * context + question) and returns the model's completion.
 */
@Injectable()
export class OllamaService {
  private readonly logger = new Logger('OllamaService');

  /**
   * Generate a diagnosis completion from a prompt.
   *
   * @param prompt - The full prompt (system instructions + RAG context +
   *                  clinical question) to send to the model.
   * @returns The generated text and the model that produced it.
   * @throws Error if Ollama is unreachable or returns an error, so the
   *              pipeline can catch it and mark the diagnosis as `failed`.
   */
  async generate(prompt: string): Promise<OllamaGenerationResult> {
    const ollamaUrl = (process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL).replace(
      /\/$/,
      '',
    );
    const model = process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;
    const endpoint = `${ollamaUrl}/api/generate`;

    // Ollama /api/generate body. stream:false → single JSON response.
    const body = {
      model,
      prompt,
      stream: false,
      // Keep generations focused; diagnoses should be concise.
      options: {
        temperature: 0.2,
        num_predict: 1024,
      },
    };

    this.logger.log(`Calling Ollama ${endpoint} (model=${model})`);

    // Native fetch — available globally in Node 20+.
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Surface HTTP failures (e.g. model not pulled, server down) clearly.
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Ollama request failed: HTTP ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}`,
      );
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    // Ollama sometimes returns 200 with an inline `error` field.
    if (data.error) {
      throw new Error(`Ollama returned an error: ${data.error}`);
    }

    return { text: data.response, model };
  }
}
