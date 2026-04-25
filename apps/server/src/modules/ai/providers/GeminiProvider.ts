import { createHash } from 'node:crypto';
import { env } from '../../../env.js';
import type {
  ILlmProvider,
  LlmContext,
  LlmGenerateResult,
  LlmToolCall,
  LlmToolDefinition,
} from './ILlmProvider.js';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

type GeminiFunctionCall = {
  name?: string;
  args?: Record<string, unknown>;
};

type GeminiPart = {
  text?: string;
  functionCall?: GeminiFunctionCall;
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[];
  };
};

type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
  cachedContent?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toGeminiContents(history: LlmContext['history'], message: string) {
  const base = history.map((item) => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: item.content }],
  }));

  return [
    ...base,
    {
      role: 'user',
      parts: [{ text: message }],
    },
  ];
}

function buildFunctionDeclarations(tools: LlmToolDefinition[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  }));
}

function extractText(candidate: GeminiCandidate | undefined): string {
  if (!candidate?.content?.parts) return '';
  const chunks = candidate.content.parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .filter((text) => text.length > 0);
  return chunks.join('').trim();
}

function extractToolCalls(candidate: GeminiCandidate | undefined): LlmToolCall[] {
  if (!candidate?.content?.parts) return [];
  const calls: LlmToolCall[] = [];

  for (const part of candidate.content.parts) {
    const functionCall = part.functionCall;
    if (!functionCall?.name) continue;
    const id = `${functionCall.name}-${calls.length + 1}`;
    calls.push({
      id,
      name: functionCall.name,
      input: functionCall.args && isRecord(functionCall.args) ? functionCall.args : {},
    });
  }

  return calls;
}

function makeCacheKey(model: string, context: LlmContext, tools: LlmToolDefinition[]): string {
  const seed = JSON.stringify({
    model,
    systemPrompt: context.systemPrompt,
    toolNames: tools.map((tool) => tool.name),
    role: context.userRole,
  });

  return createHash('sha256').update(seed).digest('hex');
}

export class GeminiProvider implements ILlmProvider {
  readonly id = 'gemini';
  readonly model: string;

  private readonly contextCache = new Map<string, string>();

  constructor(
    private readonly apiKey: string | undefined = env.GEMINI_API_KEY,
    model = env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
  ) {
    this.model = model;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(context: LlmContext, tools: LlmToolDefinition[]): Promise<LlmGenerateResult> {
    if (!this.isConfigured() || !this.apiKey) {
      throw new Error('Gemini provider not configured');
    }

    const cacheKey = makeCacheKey(this.model, context, tools);
    const cachedContent = this.contextCache.get(cacheKey);

    const body: Record<string, unknown> = {
      systemInstruction: {
        parts: [{ text: context.systemPrompt }],
      },
      contents: toGeminiContents(context.history, context.message),
      tools: [{
        functionDeclarations: buildFunctionDeclarations(tools),
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    };

    if (cachedContent) {
      body.cachedContent = cachedContent;
    }

    const url = `${GEMINI_API_BASE}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseText = await response.text();
      const shortBody = responseText.length > 300 ? `${responseText.slice(0, 300)}...` : responseText;
      throw new Error(`Gemini request failed (${response.status}): ${shortBody}`);
    }

    const payload = await response.json() as GeminiResponse;
    if (typeof payload.cachedContent === 'string' && payload.cachedContent.length > 0) {
      this.contextCache.set(cacheKey, payload.cachedContent);
    }

    const firstCandidate = payload.candidates?.[0];
    const usage = isRecord(payload.usageMetadata) ? payload.usageMetadata : {};
    const inputTokens = safeNumber(usage.promptTokenCount);
    const outputTokens = safeNumber(usage.candidatesTokenCount);
    const totalTokens = safeNumber(usage.totalTokenCount) || (inputTokens + outputTokens);
    const cachedTokens = safeNumber(usage.cachedContentTokenCount);

    return {
      text: extractText(firstCandidate),
      toolCalls: extractToolCalls(firstCandidate),
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
      },
      providerUsed: this.id,
      modelUsed: this.model,
      cached: cachedTokens > 0 || Boolean(cachedContent),
      costCents: 0,
    };
  }
}
