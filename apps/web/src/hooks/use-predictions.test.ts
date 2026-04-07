import { describe, expect, it } from 'vitest';
import { buildPredictionCards } from './use-predictions';

describe('buildPredictionCards', () => {
  it('prioriza tipos principais, normaliza confianca e limita em 3 cards', () => {
    const cards = buildPredictionCards([
      {
        prediction: {
          id: 11,
          predictionType: 'credit_score',
          confidenceScore: '0.43',
          explanation: 'Risco comercial moderado para cliente recorrente.',
          predictedValue: '0.57',
          unit: 'score',
          generatedAt: '2026-04-07T10:00:00.000Z',
        },
      },
      {
        prediction: {
          id: 9,
          predictionType: 'production_time_estimate',
          confidenceScore: '0.81',
          explanation: 'Dois trabalhos podem atrasar na sexta-feira.',
          predictedValue: '2',
          unit: 'jobs',
          generatedAt: '2026-04-07T09:00:00.000Z',
        },
      },
      {
        prediction: {
          id: 10,
          predictionType: 'stock_depletion_forecast',
          confidenceScore: '0.9',
          explanation: null,
          predictedValue: '4',
          unit: 'dias',
          generatedAt: '2026-04-07T09:30:00.000Z',
        },
      },
      {
        prediction: {
          id: 12,
          predictionType: 'revenue_forecast',
          confidenceScore: '0.67',
          explanation: 'Receita tende a crescer no próximo ciclo.',
          predictedValue: '14500.25',
          unit: 'BRL',
          generatedAt: '2026-04-07T08:00:00.000Z',
        },
      },
    ]);

    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({
      id: 9,
      title: 'Previsão de Atraso',
      confidence: 81,
      type: 'warning',
    });
    expect(cards[1]).toMatchObject({
      id: 10,
      title: 'Estoque Crítico Futuro',
      prediction: 'Valor previsto: 4 dias',
      confidence: 90,
      type: 'warning',
    });
    expect(cards[2]).toMatchObject({
      id: 12,
      title: 'Previsão de Receita',
      confidence: 67,
      type: 'positive',
    });
  });
});
