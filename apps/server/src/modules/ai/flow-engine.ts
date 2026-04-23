import type { AiMessage, Role } from '@proteticflow/shared';
import type Anthropic from '@anthropic-ai/sdk';
import { logger } from '../../logger.js';
import { buildLabContext, buildSystemPrompt } from './context-builder.js';
import { detectCommand } from './commands.js';
import { assertTenantRateLimit } from './tenant-rate-limit.js';
import { executeLlmToolCall } from './service.js';
import { setAnthropicClientForTests as setAnthropicClientForTestsInternal } from './providers/AnthropicProvider.js';
import { ProviderResolver } from './providers/ProviderResolver.js';
import { buildLlmTools } from './tools/schema-adapter.js';
import type { LlmHistoryMessage } from './providers/ILlmProvider.js';

export type StreamChunk =
  | { type: 'delta'; text: string }
  | { type: 'done'; commandDetected: string | null; tokensUsed: number };

const AI_UNAVAILABLE_MESSAGE = 'Flow IA indisponivel: configure GEMINI_API_KEY ou ANTHROPIC_API_KEY neste ambiente.';
const AI_TEMPORARY_MESSAGE = 'Flow IA indisponivel temporariamente. Tente novamente em instantes.';
const AI_RATE_LIMIT_MESSAGE = 'Flow IA indisponivel: limite do provedor esgotado no momento.';
const AI_AUTH_MESSAGE = 'Flow IA indisponivel: credencial do provedor invalida ou expirada.';

const providerResolver = new ProviderResolver();

function toProviderHistory(history: AiMessage[]): LlmHistoryMessage[] {
  return history
    .filter((message): message is AiMessage & { role: 'user' | 'assistant' } =>
      message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function classifyAiError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes('429') || message.includes('rate limit') || message.includes('resource_exhausted')) {
    return AI_RATE_LIMIT_MESSAGE;
  }
  if (message.includes('401') || message.includes('403') || message.includes('invalid') || message.includes('credencial')) {
    return AI_AUTH_MESSAGE;
  }
  if (message.includes('not configured') || message.includes('nenhum provider')) {
    return AI_UNAVAILABLE_MESSAGE;
  }
  return AI_TEMPORARY_MESSAGE;
}

export function setAnthropicClientForTests(client: Anthropic | null | undefined) {
  setAnthropicClientForTestsInternal(client);
}

export async function* streamAiResponse(
  tenantId: number,
  userRole: Role,
  userMessage: string,
  history: AiMessage[],
  userId: number,
  sessionId?: number,
): AsyncGenerator<StreamChunk> {
  const commandDetected = detectCommand(userMessage, userRole);

  assertTenantRateLimit(tenantId, 'llm');

  const context = await buildLabContext(tenantId);
  const systemPrompt = buildSystemPrompt(context, userRole);
  const llmTools = buildLlmTools(userRole);
  const llmHistory = toProviderHistory(history);

  let totalTokens = 0;
  let yieldedAnyDelta = false;

  try {
    const providerResult = await providerResolver.generate(
      {
        tenantId,
        userId,
        userRole,
        systemPrompt,
        history: llmHistory,
        message: userMessage,
      },
      llmTools,
    );

    totalTokens = providerResult.usage.totalTokens;

    if (providerResult.text.length > 0) {
      yieldedAnyDelta = true;
      yield { type: 'delta', text: providerResult.text };
    }

    for (const toolCall of providerResult.toolCalls) {
      const execution = await executeLlmToolCall(tenantId, userId, userRole, {
        sessionId,
        channel: 'text',
        rawInput: userMessage,
        toolName: toolCall.name,
        toolInput: toolCall.input,
        idempotencyKey: toolCall.id,
        providerUsed: providerResult.providerUsed,
        modelUsed: providerResult.modelUsed,
        cached: providerResult.cached,
        costCents: providerResult.costCents,
      });

      if (execution.message.length > 0) {
        yieldedAnyDelta = true;
        yield { type: 'delta', text: `\n${execution.message}` };
      }
    }
  } catch (error) {
    logger.error({ err: error, tenantId, userId }, 'ai.flow.stream_failed');
    yield { type: 'delta', text: classifyAiError(error) };
    yield { type: 'done', commandDetected, tokensUsed: totalTokens };
    return;
  }

  if (!yieldedAnyDelta) {
    yield { type: 'delta', text: AI_TEMPORARY_MESSAGE };
  }

  yield { type: 'done', commandDetected, tokensUsed: totalTokens };
}
