import Anthropic from '@anthropic-ai/sdk';
import type { AiMessage, Role } from '@proteticflow/shared';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { buildLabContext, buildSystemPrompt } from './context-builder.js';
import { detectCommand } from './commands.js';
import { AI_TOOLS } from './tools.js';
import { parseNaturalDate, resolveClientByName, resolveServiceItems } from './resolvers.js';
import * as jobService from '../jobs/service.js';

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

const AI_UNAVAILABLE_MESSAGE = 'Flow IA indisponivel: chave da Anthropic nao configurada neste ambiente.';
const AI_TEMPORARY_MESSAGE = 'Flow IA indisponivel temporariamente. Tente novamente em instantes.';
const AI_RATE_LIMIT_MESSAGE = 'Flow IA indisponivel: limite do provedor esgotado no momento.';
const AI_AUTH_MESSAGE = 'Flow IA indisponivel: credencial do provedor invalida ou expirada.';

function classifyAiError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes('rate limit') || message.includes('429')) {
    return AI_RATE_LIMIT_MESSAGE;
  }
  if (message.includes('401') || message.includes('403') || message.includes('invalid api key')) {
    return AI_AUTH_MESSAGE;
  }
  return AI_TEMPORARY_MESSAGE;
}

export async function* streamAiResponse(
  tenantId: number,
  userRole: Role,
  userMessage: string,
  history: AiMessage[],
  userId: number,
): AsyncGenerator<StreamChunk> {
  const commandDetected = detectCommand(userMessage, userRole);
  const client = getAnthropicClient();

  if (!client) {
    yield { type: 'delta', text: AI_UNAVAILABLE_MESSAGE };
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
      tools: AI_TOOLS,
    });

    let toolCallInput: string | null = null;
    let toolCallName: string | null = null;

    for await (const event of stream) {
      const eventType = (event as { type?: string }).type;

      if (eventType === 'content_block_delta') {
        const delta = (event as { delta?: { type?: string; text?: string; partial_json?: string } }).delta;
        if (delta?.type === 'text_delta' && typeof delta.text === 'string' && delta.text.length > 0) {
          yieldedAnyDelta = true;
          yield { type: 'delta', text: delta.text };
        } else if (delta?.type === 'input_json_delta') {
          if (!toolCallInput) toolCallInput = '';
          toolCallInput += delta.partial_json;
        }
      }

      if (eventType === 'content_block_start') {
        const block = (event as { content_block?: { type?: string; name?: string } }).content_block;
        if (block?.type === 'tool_use') {
          toolCallName = block.name ?? null;
        }
      }

      if (eventType === 'message_delta') {
        const usage = (event as { usage?: { output_tokens?: number } }).usage;
        if (typeof usage?.output_tokens === 'number') {
          totalTokens = usage.output_tokens;
        }
      }
    }

    if (toolCallName === 'create_job' && toolCallInput) {
      try {
        const input = JSON.parse(toolCallInput);
        const clientResolution = await resolveClientByName(tenantId, input.clientName);

        if (clientResolution.status === 'not_found') {
          yield { type: 'delta', text: `\nNao encontrei o cliente "${input.clientName}". Verifique o nome.` };
          yieldedAnyDelta = true;
        } else if (clientResolution.status === 'ambiguous') {
          const options = clientResolution.candidates
            .map((candidate) => {
              const contextText = [candidate.clinic, candidate.phone].filter(Boolean).join(' - ');
              if (contextText.length > 0) {
                return `- ${candidate.name} (id ${candidate.id}) | ${contextText}`;
              }
              return `- ${candidate.name} (id ${candidate.id})`;
            })
            .join('\n');

          yield {
            type: 'delta',
            text:
              `\nEncontrei mais de um cliente para "${input.clientName}". Me diga qual devo usar:\n${options}\n` +
              'Voce pode responder com o nome completo ou com o ID do cliente.',
          };
          yieldedAnyDelta = true;
        } else {
          const clientObj = clientResolution.client;
          const items = await resolveServiceItems(tenantId, clientObj.pricingTableId, input.items || []);
          const deadline = parseNaturalDate(input.deadline);
          const job = await jobService.createJob(
            tenantId,
            {
              clientId: clientObj.id,
              osNumber: input.osNumber,
              items: items.map((item) => ({
                priceItemId: item.priceItemId,
                serviceNameSnapshot: item.serviceName,
                quantity: item.quantity,
                unitPriceCents: item.unitPriceCents,
                adjustmentPercent: item.adjustmentPercent,
              })),
              deadline: deadline.toISOString(),
              notes: input.notes ?? 'Criado via Flow IA.',
            },
            userId,
          );
          yield {
            type: 'delta',
            text: `\nOS #${job.id} criada para ${clientObj.name}. Prazo: ${deadline.toLocaleDateString('pt-BR')}.`,
          };
          yieldedAnyDelta = true;
        }
      } catch (err) {
        console.error('Error in tool call execution', err);
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
