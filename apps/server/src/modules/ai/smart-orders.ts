import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { jobs, materials, priceItems } from '../../db/schema/index.js';
import { createRecommendation, finishModelRun, startModelRun } from './service.js';

function scoreMaterialUrgency(currentStock: number, minStock: number): number {
  if (minStock <= 0) return 0.1;
  const ratio = currentStock / minStock;
  if (ratio <= 0.4) return 0.95;
  if (ratio <= 0.7) return 0.75;
  if (ratio <= 1) return 0.55;
  return 0.2;
}

export async function refreshSmartOrders(tenantId: number, trigger: string) {
  let predictionsCreated = 0;
  let recommendationsCreated = 0;
  let modelRuns = 0;

  const run = await startModelRun(tenantId, {
    domain: 'recommendation',
    modelName: 'pf-smart-orders-heuristic',
    modelVersion: '1.0.0',
    trigger,
    recommendationType: 'smart_order',
  });
  modelRuns += 1;

  try {
    const [jobSignals] = await db.select({
      rushJobs: sql<number>`COUNT(*) FILTER (WHERE ${jobs.deadline} <= NOW() + INTERVAL '24 hours' AND ${jobs.status} <> 'delivered')`,
      activeJobs: sql<number>`COUNT(*) FILTER (WHERE ${jobs.status} IN ('pending', 'in_progress', 'quality_check', 'ready'))`,
    }).from(jobs).where(eq(jobs.tenantId, tenantId));

    const rushJobs = Number(jobSignals?.rushJobs ?? 0);
    const activeJobs = Number(jobSignals?.activeJobs ?? 0);

    if (activeJobs > 0) {
      await createRecommendation(tenantId, {
        modelRunId: run.id,
        domain: 'recommendation',
        recommendationType: 'smart_order',
        targetEntityType: 'tenant',
        targetEntityId: tenantId,
        priorityScore: Math.min(1, 0.4 + rushJobs * 0.05),
        confidenceScore: Math.min(0.92, 0.45 + activeJobs * 0.01),
        payload: {
          focusWindowHours: 24,
          rushJobs,
          activeJobs,
          action: 'prioritize_rush_and_high_value',
        },
        rationale: 'Sugestao de priorizacao de OS com foco em prazo curto e throughput operacional.',
      });
      recommendationsCreated += 1;
    }

    const lowStockMaterials = await db.select({
      id: materials.id,
      name: materials.name,
      currentStock: materials.currentStock,
      minStock: materials.minStock,
      supplierId: materials.supplierId,
    }).from(materials).where(and(
      eq(materials.tenantId, tenantId),
      eq(materials.isActive, true),
      gte(materials.minStock, '1'),
    )).limit(30);

    const rankedMaterials = lowStockMaterials
      .map((item) => ({
        materialId: item.id,
        name: item.name,
        supplierId: item.supplierId,
        urgency: scoreMaterialUrgency(Number(item.currentStock), Number(item.minStock)),
        currentStock: Number(item.currentStock),
        minStock: Number(item.minStock),
      }))
      .filter((item) => item.currentStock < item.minStock)
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 5);

    if (rankedMaterials.length > 0) {
      await createRecommendation(tenantId, {
        modelRunId: run.id,
        domain: 'recommendation',
        recommendationType: 'material_suggestion',
        targetEntityType: 'tenant',
        targetEntityId: tenantId,
        priorityScore: rankedMaterials[0]?.urgency ?? 0.5,
        confidenceScore: 0.78,
        payload: { suggestedOrder: rankedMaterials },
        rationale: 'Sugestao proativa de compra baseada em risco de ruptura de materiais ativos.',
      });
      recommendationsCreated += 1;
    }

    const topPriceItems = await db.select({
      id: priceItems.id,
      name: priceItems.name,
      estimatedDays: priceItems.estimatedDays,
      priceCents: priceItems.priceCents,
    }).from(priceItems).where(and(
      eq(priceItems.tenantId, tenantId),
      eq(priceItems.isActive, true),
    )).limit(5);

    if (topPriceItems.length > 0) {
      await createRecommendation(tenantId, {
        modelRunId: run.id,
        domain: 'recommendation',
        recommendationType: 'smart_order',
        targetEntityType: 'tenant',
        targetEntityId: tenantId,
        priorityScore: 0.64,
        confidenceScore: 0.61,
        payload: { templates: topPriceItems },
        rationale: 'Catalogo de servicos mais aderentes para acelerar montagem de OS em picos de demanda.',
      });
      recommendationsCreated += 1;
    }

    await finishModelRun(run.id, {
      status: 'completed',
      metrics: { predictionsCreated, recommendationsCreated },
    });
  } catch (error) {
    await finishModelRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Erro em smart orders',
    });
    throw error;
  }

  return { predictionsCreated, recommendationsCreated, modelRuns };
}
