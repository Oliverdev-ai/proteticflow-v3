import { createHash } from 'node:crypto';
import { env } from '../../env.js';
import { AI_MEMORY_EMBEDDING_DIMENSIONS } from '../../db/schema/ai-memory.js';

const GEMINI_EMBEDDING_MODEL = 'text-embedding-004';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type GeminiEmbeddingResponse = {
  embedding?: {
    values?: number[];
  };
};

export type EmbeddingsProvider = {
  embed(text: string): Promise<number[]>;
};

function normalizeVector(values: number[]): number[] {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) return values;
  return values.map((value) => Number((value / magnitude).toFixed(8)));
}

function deterministicEmbedding(text: string): number[] {
  const seed = createHash('sha256').update(text, 'utf8').digest();
  const values: number[] = [];

  for (let idx = 0; idx < AI_MEMORY_EMBEDDING_DIMENSIONS; idx += 1) {
    const byte = seed[idx % seed.length] ?? 0;
    values.push((byte - 128) / 128);
  }

  return normalizeVector(values);
}

function assertEmbeddingDimensions(values: number[]): number[] {
  if (values.length !== AI_MEMORY_EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding invalido: esperado ${AI_MEMORY_EMBEDDING_DIMENSIONS} dimensoes, recebido ${values.length}`);
  }
  return values;
}

export class GeminiEmbeddingsProvider implements EmbeddingsProvider {
  constructor(
    private readonly apiKey: string | undefined = env.GEMINI_API_KEY,
    private readonly nodeEnv: string = env.NODE_ENV,
  ) {}

  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      if (this.nodeEnv === 'production') {
        throw new Error('GEMINI_API_KEY obrigatoria para embeddings em producao');
      }
      return deterministicEmbedding(text);
    }

    const url = `${GEMINI_API_BASE}/models/${GEMINI_EMBEDDING_MODEL}:embedContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }],
        },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: AI_MEMORY_EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      const shortBody = responseText.length > 300 ? `${responseText.slice(0, 300)}...` : responseText;
      throw new Error(`Gemini embedding failed (${response.status}): ${shortBody}`);
    }

    const payload = await response.json() as GeminiEmbeddingResponse;
    const values = payload.embedding?.values;
    if (!Array.isArray(values)) {
      throw new TypeError('Gemini embedding response sem vetor');
    }

    return assertEmbeddingDimensions(values);
  }
}

let embeddingsProvider: EmbeddingsProvider = new GeminiEmbeddingsProvider();

export function setEmbeddingsProviderForTests(provider: EmbeddingsProvider | null): void {
  embeddingsProvider = provider ?? new GeminiEmbeddingsProvider();
}

export async function embedText(text: string): Promise<number[]> {
  return assertEmbeddingDimensions(await embeddingsProvider.embed(text));
}
