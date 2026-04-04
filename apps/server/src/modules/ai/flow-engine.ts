import Anthropic from '@anthropic-ai/sdk';
import type { AiMessage, Role } from '@proteticflow/shared';
import { env } from '../../env.js';
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

const FALLBACK_MESSAGE = 'Desculpe, estou com dificuldades tecnicas no momento. Tente novamente em instantes.';

export async function* streamAiResponse(
  tenantId: number,
  userRole: Role,
  userMessage: string,
  history: AiMessage[],
  userId: number
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
      tools: AI_TOOLS,
    });

    let toolCallInput: any = null;
    let toolCallName: string | null = null;

    for await (const event of stream) {
      const eventType = (event as { type?: string }).type;

      if (eventType === 'content_block_delta') {
        const delta = (event as any).delta;
        if (delta?.type === 'text_delta' && typeof delta.text === 'string' && delta.text.length > 0) {
          yieldedAnyDelta = true;
          yield { type: 'delta', text: delta.text };
        } else if (delta?.type === 'input_json_delta') {
          if (!toolCallInput) toolCallInput = '';
          toolCallInput += delta.partial_json;
        }
      }

      if (eventType === 'content_block_start') {
        const block = (event as any).content_block;
        if (block?.type === 'tool_use') {
          toolCallName = block.name;
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
        const clientObj = await resolveClientByName(tenantId, input.clientName);
        if (!clientObj) {
          yield { type: 'delta', text: `\nNão encontrei o cliente "${input.clientName}". Verifique o nome.` };
          yieldedAnyDelta = true;
        } else {
          const items = await resolveServiceItems(tenantId, clientObj.priceTableId, input.items || []);
          const deadline = parseNaturalDate(input.deadline);
          const job = await jobService.createJob(tenantId, {
            clientId: clientObj.id,
            osNumber: input.osNumber,
            items: items as any,
            deadline,
            notes: input.notes ?? 'Criado via Flow IA.',
          }, userId);
          yield { type: 'delta', text: `\nOS #${job.id} criada para ${clientObj.name}. Prazo: ${deadline.toLocaleDateString('pt-BR')}.` };
          yieldedAnyDelta = true;
        }
      } catch (err) {
        console.error('Error in tool call execution', err);
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
