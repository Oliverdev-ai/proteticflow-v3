import { useMemo } from 'react';
import { trpc } from '../lib/trpc';

type DashboardPredictionType =
  | 'revenue_forecast'
  | 'production_time_estimate'
  | 'stock_depletion_forecast'
  | 'rework_pattern'
  | 'credit_score'
  | 'dynamic_pricing';

type DashboardPredictionRow = {
  prediction: {
    id: number;
    predictionType: DashboardPredictionType;
    confidenceScore: string | number;
    explanation: string | null;
    predictedValue: string | number;
    unit: string;
    generatedAt: string | Date;
  };
};

export type DashboardPredictionCard = {
  id: number;
  title: string;
  prediction: string;
  confidence: number;
  type: 'positive' | 'warning' | 'info';
};

const TYPE_TITLE_MAP: Record<DashboardPredictionType, string> = {
  stock_depletion_forecast: 'Estoque Crítico Futuro',
  production_time_estimate: 'Previsão de Atraso',
  revenue_forecast: 'Previsão de Receita',
  rework_pattern: 'Risco de Remoldagem',
  dynamic_pricing: 'Preço Dinâmico',
  credit_score: 'Risco Comercial',
};

const TYPE_CARD_MAP: Record<DashboardPredictionType, DashboardPredictionCard['type']> = {
  stock_depletion_forecast: 'warning',
  production_time_estimate: 'warning',
  revenue_forecast: 'positive',
  rework_pattern: 'warning',
  dynamic_pricing: 'info',
  credit_score: 'info',
};

const TYPE_PRIORITY: DashboardPredictionType[] = [
  'production_time_estimate',
  'stock_depletion_forecast',
  'revenue_forecast',
  'rework_pattern',
  'dynamic_pricing',
  'credit_score',
];

function normalizeConfidence(input: string | number): number {
  const value = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(value)) return 0;
  const scaled = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function normalizeSummary(row: DashboardPredictionRow): string {
  const explanation = row.prediction.explanation?.trim();
  if (explanation) return explanation;

  const numericValue = Number(row.prediction.predictedValue);
  const valueText = Number.isFinite(numericValue)
    ? numericValue.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
    : String(row.prediction.predictedValue);

  return `Valor previsto: ${valueText} ${row.prediction.unit}`.trim();
}

export function buildPredictionCards(rows: DashboardPredictionRow[]): DashboardPredictionCard[] {
  const uniqueByType = new Map<DashboardPredictionType, DashboardPredictionRow>();

  for (const row of rows) {
    const type = row.prediction.predictionType;
    if (!uniqueByType.has(type)) {
      uniqueByType.set(type, row);
    }
  }

  return TYPE_PRIORITY
    .map((type) => uniqueByType.get(type))
    .filter((row): row is DashboardPredictionRow => Boolean(row))
    .slice(0, 3)
    .map((row) => {
      const predictionType = row.prediction.predictionType;
      return {
        id: row.prediction.id,
        title: TYPE_TITLE_MAP[predictionType],
        prediction: normalizeSummary(row),
        confidence: normalizeConfidence(row.prediction.confidenceScore),
        type: TYPE_CARD_MAP[predictionType],
      };
    });
}

export function usePredictions(limit = 20) {
  const query = trpc.ai.listPredictions.useQuery(
    { limit },
    { refetchInterval: 5 * 60 * 1000 },
  );

  const cards = useMemo(
    () => buildPredictionCards(query.data ?? []),
    [query.data],
  );

  return {
    ...query,
    cards,
  };
}
