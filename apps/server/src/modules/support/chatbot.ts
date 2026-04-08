import { and, eq } from 'drizzle-orm';
import type { AiMessage } from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { autoResponseTemplates } from '../../db/schema/support.js';
import { streamAiResponse } from '../ai/flow-engine.js';

export function detectIntent(message: string): string {
  const patterns: Array<{ intent: string; patterns: RegExp[] }> = [
    { intent: 'complaint', patterns: [/reclam[aã]c[aã]o/i, /insatisfeito/i, /ruim/i] },
    { intent: 'status_query', patterns: [/status|andamento|pronto|entregue/i] },
    { intent: 'scheduling', patterns: [/agend|prova|data|hora/i] },
    { intent: 'quote', patterns: [/or[cç]amento|pre[cç]o|valor|quanto/i] },
    { intent: 'technical_support', patterns: [/problema|erro|defeito|suporte/i] },
  ];

  for (const { intent, patterns: expressions } of patterns) {
    if (expressions.some((expression) => expression.test(message))) {
      return intent;
    }
  }

  return 'general';
}

export async function findTemplate(tenantId: number, intent: string) {
  const [template] = await db
    .select()
    .from(autoResponseTemplates)
    .where(and(
      eq(autoResponseTemplates.tenantId, tenantId),
      eq(autoResponseTemplates.intent, intent),
      eq(autoResponseTemplates.isActive, 1),
    ))
    .limit(1);

  return template ?? null;
}

export async function generateChatbotResponse(
  tenantId: number,
  message: string,
  history: AiMessage[],
  intent: string | null,
): Promise<string> {
  if (intent) {
    const template = await findTemplate(tenantId, intent);
    if (template) {
      return template.body;
    }
  }

  let fullText = '';
  // Passamos 0 como userId para identificar acoes do chatbot/sistema
  for await (const chunk of streamAiResponse(tenantId, 'recepcao', message, history, 0)) {
    if (chunk.type === 'delta') {
      fullText += chunk.text;
    }
  }

  const trimmed = fullText.trim();
  return trimmed.length > 0
    ? trimmed
    : 'Desculpe, nao consegui processar sua mensagem. Tente novamente.';
}
