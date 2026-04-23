import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../../env.js';
import type {
  ILlmProvider,
  LlmContext,
  LlmGenerateResult,
  LlmToolCall,
  LlmToolDefinition,
} from './ILlmProvider.js';

const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

let injectedClient: Anthropic | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toAnthropicHistory(history: LlmContext['history']) {
  return history.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function toAnthropicTools(tools: LlmToolDefinition[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: normalizeAnthropicSchema(tool.inputSchema),
  }));
}

function normalizeAnthropicSchema(schema: Record<string, unknown>) {
  const type = schema.type;
  if (type === 'object') {
    return schema as { type: 'object' } & Record<string, unknown>;
  }

  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required)
    ? schema.required.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    type: 'object' as const,
    properties,
    required,
    additionalProperties: false,
  };
}

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function extractToolCalls(content: unknown): LlmToolCall[] {
  if (!Array.isArray(content)) return [];

  const calls: LlmToolCall[] = [];
  for (const block of content) {
    if (!isRecord(block)) continue;
    if (block.type !== 'tool_use') continue;
    const name = typeof block.name === 'string' ? block.name : '';
    if (!name) continue;
    const id = typeof block.id === 'string' && block.id.length > 0
      ? block.id
      : `${name}-${calls.length + 1}`;
    const input = isRecord(block.input) ? block.input : {};
    calls.push({ id, name, input });
  }

  return calls;
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return '';

  const chunks: string[] = [];
  for (const block of content) {
    if (!isRecord(block)) continue;
    if (block.type !== 'text') continue;
    if (typeof block.text === 'string' && block.text.length > 0) {
      chunks.push(block.text);
    }
  }

  return chunks.join('').trim();
}

export function setAnthropicClientForTests(client: Anthropic | null | undefined) {
  injectedClient = client;
}

export class AnthropicProvider implements ILlmProvider {
  readonly id = 'anthropic';
  readonly model: string;

  private cachedClient: Anthropic | null | undefined;

  constructor(
    private readonly apiKey: string | undefined = env.ANTHROPIC_API_KEY,
    model = env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
  ) {
    this.model = model;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private getClient(): Anthropic | null {
    if (injectedClient !== undefined) {
      return injectedClient;
    }
    if (!this.isConfigured() || !this.apiKey) {
      return null;
    }
    if (this.cachedClient === undefined) {
      this.cachedClient = new Anthropic({ apiKey: this.apiKey });
    }
    return this.cachedClient;
  }

  async generate(context: LlmContext, tools: LlmToolDefinition[]): Promise<LlmGenerateResult> {
    const client = this.getClient();
    if (!client) {
      throw new Error('Anthropic provider not configured');
    }

    const response = await client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: [{
        type: 'text',
        text: context.systemPrompt,
        cache_control: { type: 'ephemeral' },
      }],
      messages: [
        ...toAnthropicHistory(context.history),
        { role: 'user', content: context.message },
      ],
      tools: toAnthropicTools(tools),
    });

    const usageRecord = isRecord(response.usage) ? response.usage : undefined;
    const inputTokens = safeNumber(usageRecord?.['input_tokens']);
    const outputTokens = safeNumber(usageRecord?.['output_tokens']);
    const cacheReadTokens = safeNumber(usageRecord?.['cache_read_input_tokens']);
    const totalTokens = inputTokens + outputTokens;

    return {
      text: extractText(response.content),
      toolCalls: extractToolCalls(response.content),
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
      },
      providerUsed: this.id,
      modelUsed: this.model,
      cached: cacheReadTokens > 0,
      costCents: 0,
    };
  }
}
