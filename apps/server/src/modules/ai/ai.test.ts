import { afterEach, describe, expect, it } from 'vitest';
import {
  aiFeatureFlagsSchema,
  listAiPredictionsSchema,
  listAiRecommendationsSchema,
  recordAiFeedbackSchema,
} from '@proteticflow/shared';
import { detectCommand } from './commands.js';
import { setAnthropicClientForTests, streamAiResponse } from './flow-engine.js';
import { buildSystemPrompt } from './context-builder.js';
import * as aiService from './service.js';

describe('ai commands RBAC', () => {
  it('T01 detecta trabalhos pendentes para producao', () => {
    const result = detectCommand('mostrar trabalhos pendentes', 'producao');
    expect(result).toBe('trabalhos_pendentes');
  });

  it('T02 bloqueia relatorio AR para producao', () => {
    const result = detectCommand('gerar relatorio de contas a receber', 'producao');
    expect(result).toBeNull();
  });

  it('T03 permite relatorio AR para gerente', () => {
    const result = detectCommand('gerar relatorio de contas a receber', 'gerente');
    expect(result).toBe('relatorio_ar');
  });
});

describe('ai prompts e fallback', () => {
  afterEach(() => {
    setAnthropicClientForTests(undefined);
  });

  it('inclui restricao financeira para role producao no system prompt', () => {
    const prompt = buildSystemPrompt({
      totalClients: 10,
      jobsByStatus: { pending: 2 },
      deliveriesToday: 1,
      criticalStock: 0,
      overdueAr: 0,
      pendingAr: 0,
    }, 'producao');

    expect(prompt).toContain('RESTRICAO: nao forneca informacoes financeiras');
  });

  it('T10 retorna fallback amigavel quando API nao esta disponivel', async () => {
    setAnthropicClientForTests(null);

    const chunks = [];
    for await (const chunk of streamAiResponse(1, 'gerente', 'oi', [], 1)) {
      chunks.push(chunk);
    }

    const first = chunks[0];
    const last = chunks[chunks.length - 1];

    expect(first?.type).toBe('delta');
    expect(first && 'text' in first ? first.text : '').toContain('dificuldades tecnicas');
    expect(last?.type).toBe('done');
  });
});

describe('ai avancada contracts', () => {
  it('T22 valida defaults de flags e filtros', () => {
    const flags = aiFeatureFlagsSchema.parse({});
    const predictions = listAiPredictionsSchema.parse({});
    const recommendations = listAiRecommendationsSchema.parse({});

    expect(flags.forecasting).toBe(true);
    expect(flags.operations).toBe(true);
    expect(flags.recommendation).toBe(true);
    expect(predictions.limit).toBe(20);
    expect(recommendations.limit).toBe(20);
  });

  it('T23 valida input de feedback de recomendacao', () => {
    const parsed = recordAiFeedbackSchema.parse({
      recommendationId: 7,
      decision: 'accepted',
      confidenceDelta: 0.1,
    });

    expect(parsed.recommendationId).toBe(7);
    expect(parsed.decision).toBe('accepted');
  });

  it('T24 expõe APIs de refresh avançado no service', () => {
    expect(typeof aiService.runDailyRefresh).toBe('function');
    expect(typeof aiService.runRevenueForecastRefresh).toBe('function');
    expect(typeof aiService.runScheduleOptimizationRefresh).toBe('function');
    expect(typeof aiService.runClientCreditScoreRefresh).toBe('function');
  });
});
