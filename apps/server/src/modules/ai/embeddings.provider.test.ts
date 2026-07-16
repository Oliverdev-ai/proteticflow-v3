import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_MEMORY_EMBEDDING_DIMENSIONS } from '../../db/schema/ai-memory.js';
import { GeminiEmbeddingsProvider } from './embeddings.provider.js';

function embeddingResponse(): Response {
  return new Response(JSON.stringify({
    embedding: {
      values: Array.from({ length: AI_MEMORY_EMBEDDING_DIMENSIONS }, () => 1),
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GeminiEmbeddingsProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envia GEMINI_API_KEY em header, nunca na query string', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => embeddingResponse());
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GeminiEmbeddingsProvider('gemini-secret', 'test');
    await provider.embed('preferencia de entrega');

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall!;

    expect(String(url)).not.toContain('key=');
    expect(init).toMatchObject({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-goog-api-key': 'gemini-secret',
      }),
    });
  });

  it('falha em producao quando GEMINI_API_KEY esta ausente', async () => {
    const provider = new GeminiEmbeddingsProvider(undefined, 'production');

    await expect(provider.embed('sem chave')).rejects.toThrow('GEMINI_API_KEY obrigatoria');
  });
});
