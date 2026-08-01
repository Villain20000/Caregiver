/**
 * services/ai-rag/src/rag/__tests__/ollama.service.spec.ts
 *
 * Unit tests for OllamaService — the local LLM inference client.
 *
 * The service uses the native global `fetch`, which is stubbed per-test so
 * no real HTTP call is made. Env vars (OLLAMA_URL, OLLAMA_MODEL) are
 * cleared in beforeEach so defaults are exercised unless a test sets them.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OllamaService } from '../ollama.service.js';

describe('OllamaService', () => {
  let service: OllamaService;
  const fetchMock = vi.fn();

  beforeEach(() => {
    delete process.env.OLLAMA_URL;
    delete process.env.OLLAMA_MODEL;
    fetchMock.mockReset();
    // Stub the native fetch used by the service.
    vi.stubGlobal('fetch', fetchMock);
    service = new OllamaService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Build a minimal Response-like object satisfying the fetch contract. */
  const okResponse = (body: unknown) =>
    ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue(body),
      text: vi.fn().mockResolvedValue(''),
    }) as unknown as Response;

  const httpErrorResponse = (status: number, detail = '') =>
    ({
      ok: false,
      status,
      statusText: 'Internal Server Error',
      json: vi.fn(),
      text: vi.fn().mockResolvedValue(detail),
    }) as unknown as Response;

  it('calls the default Ollama endpoint with the expected request body', async () => {
    fetchMock.mockResolvedValue(okResponse({ response: 'Diagnosis text', done: true }));

    const result = await service.generate('Some clinical question');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:11434/api/generate');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('llama3:8b');
    expect(body.prompt).toBe('Some clinical question');
    expect(body.stream).toBe(false);
    expect(body.options).toEqual({ temperature: 0.2, num_predict: 1024 });

    expect(result).toEqual({ text: 'Diagnosis text', model: 'llama3:8b' });
  });

  it('honors OLLAMA_URL (stripping trailing slash) and OLLAMA_MODEL env vars', async () => {
    process.env.OLLAMA_URL = 'http://ollama.internal:11435/';
    process.env.OLLAMA_MODEL = 'mistral:7b';
    fetchMock.mockResolvedValue(okResponse({ response: 'hi', done: true }));

    const result = await service.generate('q');

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://ollama.internal:11435/api/generate');
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.model).toBe('mistral:7b');
    expect(result.model).toBe('mistral:7b');
  });

  it('throws a descriptive error when Ollama returns a non-OK HTTP status', async () => {
    fetchMock.mockResolvedValue(httpErrorResponse(500, 'model not found'));

    await expect(service.generate('q')).rejects.toThrow(
      'Ollama request failed: HTTP 500 Internal Server Error — model not found',
    );
  });

  it('throws when Ollama reports an inline error field on a 200 response', async () => {
    fetchMock.mockResolvedValue(okResponse({ response: '', done: false, error: 'out of memory' }));

    await expect(service.generate('q')).rejects.toThrow('Ollama returned an error: out of memory');
  });

  it('propagates network failures (fetch rejection)', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.generate('q')).rejects.toThrow('ECONNREFUSED');
  });
});
