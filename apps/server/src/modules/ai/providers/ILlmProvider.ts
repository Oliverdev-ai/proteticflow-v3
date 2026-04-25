import type { Role } from '@proteticflow/shared';

export type LlmHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type LlmContext = {
  tenantId: number;
  userId: number;
  userRole: Role;
  systemPrompt: string;
  history: LlmHistoryMessage[];
  message: string;
};

export type LlmToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type LlmToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type LlmStreamChunk =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; toolCall: LlmToolCall };

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type LlmGenerateResult = {
  text: string;
  toolCalls: LlmToolCall[];
  usage: LlmUsage;
  providerUsed: string;
  modelUsed: string;
  cached: boolean;
  costCents: number;
};

export interface ILlmProvider {
  readonly id: string;
  readonly model: string;

  isConfigured(): boolean;
  generate(context: LlmContext, tools: LlmToolDefinition[]): Promise<LlmGenerateResult>;
}
