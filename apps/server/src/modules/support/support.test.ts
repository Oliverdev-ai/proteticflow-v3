import { describe, expect, it } from 'vitest';
import { createSupportSuggestionSchema } from '@proteticflow/shared';
import { detectIntent } from './chatbot.js';

describe('support chatbot intent detection', () => {
  it('T03 detectIntent identifica status_query', () => {
    expect(detectIntent('qual o status do meu trabalho')).toBe('status_query');
  });

  it('T04 detectIntent identifica complaint', () => {
    expect(detectIntent('quero fazer uma reclamacao agora')).toBe('complaint');
  });

  it('valida payload de sugestao', () => {
    const payload = createSupportSuggestionSchema.parse({
      title: 'Nova filtragem no Kanban',
      description: 'Permitir filtro rapido por dentista e etapa para agilizar operacao diaria.',
      category: 'product',
      perceivedImpact: 'high',
    });

    expect(payload.category).toBe('product');
    expect(payload.perceivedImpact).toBe('high');
  });
});
