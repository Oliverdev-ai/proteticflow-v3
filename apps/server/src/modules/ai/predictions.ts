import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { materials } from '../../db/schema/index.js';
import {
  buildLeadTimeFeatures,
  buildRevenueBaseline,
  buildStockPressureFeatures,
  createPrediction,
  createRecommendation,
  finishModelRun,
  saveFeatureSnapshot,
  startModelRun,
} from './service.js';

export async function refreshForecasting(tenantId: number, trigger: string) {
  let predictionsCreated = 0;
  let recommendationsCreated = 0;
  let modelRuns = 0;

  const run = await startModelRun(tenantId, {
    domain: 'forecasting',
    modelName: 'pf-forecasting-heuristic',
    modelVersion: '1.0.0',
    trigger,
    predictionType: 'revenue_forecast',
  });
  modelRuns += 1;

  try {
    const revenue = await buildRevenueBaseline(tenantId);
    const lead = await buildLeadTimeFeatures(tenantId);
    const stock = await buildStockPressureFeatures(tenantId);

    const revenueConfidence = Math.min(1, 0.45 + revenue.samples * 0.1);
    const leadPenalty = Math.min(0.25, lead.overdueCount * 0.01);
    const stockPenalty = stock.totalMaterials === 0
      ? 0.2
      : Math.min(0.2, (stock.belowMin / stock.totalMaterials) * 0.3);
    const confidence = Math.max(0.05, revenueConfidence - leadPenalty - stockPenalty);
    const adjustedRevenue = Math.max(0, Math.round(revenue.baselineRevenueCents * (1 - leadPenalty)));

    const snapshot = await saveFeatureSnapshot(tenantId, {
      modelRunId: run.id,
      domain: 'forecasting',
      entityType: 'tenant',
      entityId: tenantId,
      features: {
        baselineRevenueCents: revenue.baselineRevenueCents,
        samples: revenue.samples,
        avgLeadHours: lead.avgLeadHours,
        overdueCount: lead.overdueCount,
        stockPressureRatio: stock.totalMaterials === 0 ? 0 : stock.belowMin / stock.totalMaterials,
      },
    });

    await createPrediction(tenantId, {
      modelRunId: run.id,
      featureSnapshotId: snapshot.id,
      domain: 'forecasting',
      predictionType: 'revenue_forecast',
      entityType: 'tenant',
      entityId: tenantId,
      predictedValue: adjustedRevenue,
      forecastWindowDays: 30,
      unit: 'cents',
      confidenceScore: confidence,
      explanation: 'Receita prevista para 30 dias com ajuste por atraso operacional e pressao de estoque.',
      explainability: {
        baseline: revenue.baselineRevenueCents,
        delayPenalty: leadPenalty,
        stockPenalty,
      },
    });
    predictionsCreated += 1;

    await createPrediction(tenantId, {
      modelRunId: run.id,
      featureSnapshotId: snapshot.id,
      domain: 'forecasting',
      predictionType: 'production_time_estimate',
      entityType: 'tenant',
      entityId: tenantId,
      predictedValue: Math.max(8, lead.avgLeadHours || 72),
      forecastWindowDays: 7,
      unit: 'hours',
      confidenceScore: Math.max(0.2, confidence - 0.1),
      explanation: 'Estimativa media de lead time com base no historico de conclusao.',
      explainability: {
        avgLeadHours: lead.avgLeadHours,
        activeCount: lead.activeCount,
      },
    });
    predictionsCreated += 1;

    const lowStock = await db.select({
      id: materials.id,
      name: materials.name,
      currentStock: materials.currentStock,
      minStock: materials.minStock,
    }).from(materials).where(eq(materials.tenantId, tenantId)).limit(5);

    if (lowStock.length > 0) {
      const top = lowStock
        .map((item) => ({
          id: item.id,
          name: item.name,
          ratio: Number(item.minStock) === 0 ? 0 : Number(item.currentStock) / Number(item.minStock),
        }))
        .filter((item) => item.ratio < 1)
        .sort((a, b) => a.ratio - b.ratio)
        .slice(0, 3);

      if (top.length > 0) {
        await createRecommendation(tenantId, {
          modelRunId: run.id,
          domain: 'forecasting',
          recommendationType: 'material_suggestion',
          targetEntityType: 'tenant',
          targetEntityId: tenantId,
          confidenceScore: Math.min(0.95, confidence + 0.1),
          priorityScore: 0.7,
          payload: { items: top },
          rationale: 'Materiais abaixo do minimo com risco de ruptura no curto prazo.',
        });
        recommendationsCreated += 1;
      }
    }

    await finishModelRun(run.id, {
      status: 'completed',
      metrics: { predictionsCreated, recommendationsCreated },
    });
  } catch (error) {
    await finishModelRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Erro desconhecido em forecasting',
    });
    throw error;
  }

  return { predictionsCreated, recommendationsCreated, modelRuns };
}
