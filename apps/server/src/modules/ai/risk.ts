import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { accountsReceivable, clients } from '../../db/schema/index.js';
import { createPrediction, createRecommendation, finishModelRun, startModelRun } from './service.js';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export async function refreshRiskSignals(tenantId: number, trigger: string) {
  let predictionsCreated = 0;
  let recommendationsCreated = 0;
  let modelRuns = 0;

  const run = await startModelRun(tenantId, {
    domain: 'risk_commercial',
    modelName: 'pf-risk-heuristic',
    modelVersion: '1.0.0',
    trigger,
    predictionType: 'credit_score',
  });
  modelRuns += 1;

  try {
    const clientSignals = await db.select({
      clientId: clients.id,
      clientName: clients.name,
      totalAmount: sql<number>`COALESCE(SUM(${accountsReceivable.amountCents}), 0)`,
      overdueAmount: sql<number>`
        COALESCE(SUM(CASE WHEN ${accountsReceivable.status} = 'overdue' THEN ${accountsReceivable.amountCents} ELSE 0 END), 0)
      `,
      overdueCount: sql<number>`COUNT(*) FILTER (WHERE ${accountsReceivable.status} = 'overdue')`,
    }).from(clients)
      .leftJoin(accountsReceivable, and(
        eq(accountsReceivable.clientId, clients.id),
        eq(accountsReceivable.tenantId, tenantId),
      ))
      .where(eq(clients.tenantId, tenantId))
      .groupBy(clients.id, clients.name)
      .limit(40);

    for (const row of clientSignals) {
      const total = Number(row.totalAmount ?? 0);
      const overdue = Number(row.overdueAmount ?? 0);
      const overdueRatio = total === 0 ? 0 : overdue / total;
      const overdueCount = Number(row.overdueCount ?? 0);

      const riskScore = clamp(overdueRatio * 0.7 + overdueCount * 0.08, 0, 1);
      const creditScore = clamp(1 - riskScore, 0.05, 1);

      const prediction = await createPrediction(tenantId, {
        modelRunId: run.id,
        domain: 'risk_commercial',
        predictionType: 'credit_score',
        entityType: 'client',
        entityId: row.clientId,
        predictedValue: Number((creditScore * 100).toFixed(2)),
        confidenceScore: clamp(0.6 + total / 500000, 0.35, 0.95),
        explanation: `Score de credito com base em inadimplencia historica de ${row.clientName}.`,
        explainability: { overdueRatio, overdueCount, totalAmountCents: total },
        unit: 'score_0_100',
      });
      predictionsCreated += 1;

      if (riskScore >= 0.45) {
        await createRecommendation(tenantId, {
          predictionId: prediction.id,
          modelRunId: run.id,
          domain: 'risk_commercial',
          recommendationType: 'collection_strategy',
          targetEntityType: 'client',
          targetEntityId: row.clientId,
          confidenceScore: Math.min(0.95, 0.5 + riskScore * 0.4),
          priorityScore: riskScore,
          payload: {
            channel: ['email', 'in_app'],
            policy: overdueRatio > 0.65 ? 'strict_followup' : 'soft_followup',
            overdueCount,
          },
          rationale: 'Cobranca inteligente apenas como recomendacao, sem disparo automatico critico.',
        });
        recommendationsCreated += 1;
      }
    }

    await finishModelRun(run.id, {
      status: 'completed',
      metrics: {
        predictionsCreated,
        recommendationsCreated,
      },
    });
  } catch (error) {
    await finishModelRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Erro em risco/comercial',
    });
    throw error;
  }

  return { predictionsCreated, recommendationsCreated, modelRuns };
}
