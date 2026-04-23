import { describe, expect, it } from 'vitest';
import { toTtsSsml } from './tts-ssml.js';

describe('toTtsSsml', () => {
  it('normaliza codigo de OS para pronunciacao cardinal', () => {
    const ssml = toTtsSsml('OS 156 pronta para entrega');
    expect(ssml).toContain('<say-as interpret-as="characters">OS</say-as>');
    expect(ssml).toContain('<say-as interpret-as="cardinal">156</say-as>');
  });

  it('converte moeda para extenso', () => {
    const ssml = toTtsSsml('Total: R$ 14.200,50');
    expect(ssml).toContain('quatorze mil e duzentos reais');
    expect(ssml).toContain('cinquenta centavos');
  });

  it('normaliza codigos de cor dentaria', () => {
    const ssml = toTtsSsml('Use cor A3 no acabamento');
    expect(ssml).toContain('A tres');
  });
});
