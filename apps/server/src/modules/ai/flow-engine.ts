import Anthropic from '@anthropic-ai/sdk';
import type { AiMessage, Role } from '@proteticflow/shared';
import { env } from '../../env.js';
import { buildLabContext, buildSystemPrompt } from './context-builder.js';
import { detectCommand } from './commands.js';

export type StreamChunk =
  | { type: 'delta'; text: string }
  | { type: 'done'; commandDetected: string | null; tokensUsed: number };

let cachedClient: Anthropic | null | undefined;

export function setAnthropicClientForTests(client: Anthropic | null | undefined) {
  cachedClient = client;
}

function getAnthropicClient(): Anthropic | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  if (!env.ANTHROPIC_API_KEY) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return cachedClient;
}

function toAnthropicHistory(history: AiMessage[]) {
  return history
    .filter((message): message is AiMessage & { role: 'user' | 'assistant' } =>
      message.role === 'user' || message.role === 'assistant')
    .map((message) => ({ role: message.role, content: message.content }));
}

const FALLBACK_MESSAGE = 'Desculpe, estou com dificuldades tecnicas no momento. Tente novamente em instantes.';

export async function* streamAiResponse(
  tenantId: number,
  userRole: Role,
  userMessage: string,
  history: AiMessage[],
): AsyncGenerator<StreamChunk> {
  const commandDetected = detectCommand(userMessage, userRole);
  const client = getAnthropicClient();

  if (!client) {
    yield { type: 'delta', text: FALLBACK_MESSAGE };
    yield { type: 'done', commandDetected, tokensUsed: 0 };
    return;
  }

  const context = await buildLabContext(tenantId);
  const systemPrompt = buildSystemPrompt(context, userRole);
  const messages = [
    ...toAnthropicHistory(history),
    { role: 'user' as const, content: userMessage },
  ];

  let totalTokens = 0;
  let yieldedAnyDelta = false;

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    for await (const event of stream) {
      const eventType = (event as { type?: string }).type;

      if (eventType === 'content_block_delta') {
        const delta = (event as { delta?: { type?: string; text?: string } }).delta;
        if (delta?.type === 'text_delta' && typeof delta.text === 'string' && delta.text.length > 0) {
          yieldedAnyDelta = true;
          yield { type: 'delta', text: delta.text };
        }
      }

      if (eventType === 'message_delta') {
        const usage = (event as { usage?: { output_tokens?: number } }).usage;
        if (typeof usage?.output_tokens === 'number') {
          totalTokens = usage.output_tokens;
        }
      }
    }
  } catch {
    yield { type: 'delta', text: FALLBACK_MESSAGE };
    yield { type: 'done', commandDetected, tokensUsed: totalTokens };
    return;
  }

  if (!yieldedAnyDelta) {
    yield { type: 'delta', text: FALLBACK_MESSAGE };
  }

  yield { type: 'done', commandDetected, tokensUsed: totalTokens };
}
