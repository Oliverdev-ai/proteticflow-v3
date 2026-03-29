import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { events, jobs } from '../../db/schema/index.js';
import {
  createRecommendation,
  finishModelRun,
  saveFeatureSnapshot,
  startModelRun,
} from './service.js';

type JobCandidate = {
  id: number;
  deadline: Date;
  totalCents: number;
  assignedTo: number | null;
  status: 'pending' | 'in_progress' | 'quality_check' | 'ready' | 'delivered' | 'cancelled';
};

function hoursUntil(date: Date): number {
  return (date.getTime() - Date.now()) / 3600000;
}

function computePriority(job: JobCandidate): number {
  const deadlineHours = hoursUntil(job.deadline);
  const urgency = deadlineHours <= 0 ? 1 : Math.max(0, 1 - deadlineHours / 96);
  const valueFactor = Math.min(1, job.totalCents / 150000);
  const stageFactor = job.status === 'pending' ? 0.45 : job.status === 'in_progress' ? 0.75 : 0.9;
  return Math.max(0, Math.min(1, urgency * 0.55 + valueFactor * 0.3 + stageFactor * 0.15));
}

export async function refreshOperationalRecommendations(tenantId: number, trigger: string) {
  let predictionsCreated = 0;
  let recommendationsCreated = 0;
  let modelRuns = 0;

  const run = await startModelRun(tenantId, {
    domain: 'operations',
    modelName: 'pf-scheduling-heuristic',
    modelVersion: '1.0.0',
    trigger,
    recommendationType: 'schedule_optimization',
  });
  modelRuns += 1;

  try {
    const rows = await db.select({
      id: jobs.id,
      deadline: jobs.deadline,
      totalCents: jobs.totalCents,
      assignedTo: jobs.assignedTo,
      status: jobs.status,
    }).from(jobs).where(and(
      eq(jobs.tenantId, tenantId),
      inArray(jobs.status, ['pending', 'in_progress', 'quality_check', 'ready']),
    )).limit(40);

    const candidates: JobCandidate[] = rows.map((row) => ({
      id: row.id,
      deadline: row.deadline,
      totalCents: row.totalCents,
      assignedTo: row.assignedTo,
      status: row.status,
    }));

    const ranked = candidates
      .map((job) => ({ ...job, score: computePriority(job) }))
      .sort((a, b) => b.score - a.score);

    if (ranked.length > 0) {
      const top = ranked.slice(0, 10).map((item, index) => ({
        jobId: item.id,
        rank: index + 1,
        score: Number(item.score.toFixed(4)),
        assignedTo: item.assignedTo,
      }));

      const snapshot = await saveFeatureSnapshot(tenantId, {
        modelRunId: run.id,
        domain: 'operations',
        entityType: 'tenant',
        entityId: tenantId,
        features: {
          evaluatedJobs: ranked.length,
          avgPriority: ranked.reduce((acc, item) => acc + item.score, 0) / ranked.length,
        },
      });

      await createRecommendation(tenantId, {
        modelRunId: run.id,
        domain: 'operations',
        recommendationType: 'production_sequence',
        targetEntityType: 'tenant',
        targetEntityId: tenantId,
        priorityScore: 0.82,
        confidenceScore: Math.min(0.95, 0.55 + ranked.length * 0.01),
        payload: {
          snapshotId: snapshot.id,
          sequence: top,
        },
        rationale: 'Sequenciamento sugerido com prioridade por prazo, valor e etapa atual.',
      });
      recommendationsCreated += 1;
    }

    const [conflicts] = await db.select({
      total: sql<number>`COUNT(*) FILTER (WHERE ${events.startAt} <= ${events.endAt})`,
    }).from(events).where(eq(events.tenantId, tenantId));

    const conflictCount = Number(conflicts?.total ?? 0);
    if (conflictCount > 0) {
      await createRecommendation(tenantId, {
        modelRunId: run.id,
        domain: 'operations',
        recommendationType: 'schedule_optimization',
        targetEntityType: 'tenant',
        targetEntityId: tenantId,
        priorityScore: Math.min(1, 0.3 + conflictCount * 0.02),
        confidenceScore: Math.min(1, 0.4 + conflictCount * 0.01),
        payload: { conflictCount, action: 'rebalance_agenda' },
        rationale: 'Agenda com eventos concorrentes. Recomenda-se redistribuicao de janelas e tecnicos.',
      });
      recommendationsCreated += 1;
    }

    await finishModelRun(run.id, {
      status: 'completed',
      metrics: {
        predictionsCreated,
        recommendationsCreated,
        evaluatedJobs: ranked.length,
      },
    });
  } catch (error) {
    await finishModelRun(run.id, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Erro em otimizacao operacional',
    });
    throw error;
  }

  return { predictionsCreated, recommendationsCreated, modelRuns };
}
