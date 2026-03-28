import { describe, expect, it } from 'vitest';
import { detectIntent } from './chatbot.js';

describe('support chatbot intent detection', () => {
  it('T03 detectIntent identifica status_query', () => {
    expect(detectIntent('qual o status do meu trabalho')).toBe('status_query');
  });

  it('T04 detectIntent identifica complaint', () => {
    expect(detectIntent('quero fazer uma reclamacao agora')).toBe('complaint');
  });
});
