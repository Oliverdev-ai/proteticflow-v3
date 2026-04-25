import { TRPCError } from '@trpc/server';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import {
  canTransition,
  jobsOverdueSchema,
  jobsStatusUpdateSchema,
  type JobsOverdueInput,
  type JobsStatusUpdateInput,
} from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { clients } from '../../../db/schema/clients.js';
import { jobs } from '../../../db/schema/jobs.js';
import * as jobService from '../../jobs/service.js';
import type { CommandPreview, ConfirmationStep, ToolContext } from '../tool-executor.js';

type PreviewStepResult = {
  step: ConfirmationStep;
  preview: CommandPreview;
  resolvedInput?: unknown;
};

function daysOverdue(deadline: Date): number {
  const diffMs = Date.now() - deadline.getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

async function getScopedJobForAi(tenantId: number, jobId: number) {
  const [job] = await db
    .select({
      id: jobs.id,
      code: jobs.code,
      status: jobs.status,
      deadline: jobs.deadline,
      patientName: jobs.patientName,
      clientName: clients.name,
    })
    .from(jobs)
    .leftJoin(clients, and(
      eq(clients.id, jobs.clientId),
      eq(clients.tenantId, tenantId),
    ))
    .where(and(
      eq(jobs.tenantId, tenantId),
      eq(jobs.id, jobId),
      isNull(jobs.deletedAt),
    ))
    .limit(1);

  if (!job) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'OS nao encontrada' });
  }

  return job;
}

export async function executeJobsOverdue(
  ctx: ToolContext,
  input: JobsOverdueInput,
) {
  const parsed = jobsOverdueSchema.parse(input);
  const conditions = [
    eq(jobs.tenantId, ctx.tenantId),
    isNull(jobs.deletedAt),
    isNull(jobs.suspendedAt),
    lt(jobs.deadline, new Date()),
    sql`${jobs.status} not in ('delivered', 'cancelled', 'suspended', 'rework_in_progress')`,
  ];

  if (parsed.assignedTo) {
    conditions.push(eq(jobs.assignedTo, parsed.assignedTo));
  }

  if (parsed.severity === 'critical') {
    const threshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    conditions.push(lt(jobs.deadline, threshold));
  }

  const rows = await db
    .select({
      id: jobs.id,
      code: jobs.code,
      status: jobs.status,
      deadline: jobs.deadline,
      patientName: jobs.patientName,
      assignedTo: jobs.assignedTo,
      clientName: clients.name,
    })
    .from(jobs)
    .leftJoin(clients, and(
      eq(clients.id, jobs.clientId),
      eq(clients.tenantId, ctx.tenantId),
    ))
    .where(and(...conditions))
    .orderBy(sql`${jobs.deadline} asc`, jobs.id);

  const items = rows.map((row) => ({
    jobId: row.id,
    code: row.code,
    status: row.status,
    clientName: row.clientName ?? null,
    patientName: row.patientName ?? null,
    assignedTo: row.assignedTo ?? null,
    deadline: row.deadline.toISOString(),
    daysOverdue: daysOverdue(row.deadline),
  })).sort((a, b) => b.daysOverdue - a.daysOverdue);

  if (items.length === 0) {
    return {
      status: 'ok',
      severity: parsed.severity,
      total: 0,
      message: 'Tudo em dia.',
      jobs: [],
    };
  }

  return {
    status: 'ok',
    severity: parsed.severity,
    total: items.length,
    jobs: items,
  };
}

export async function buildJobsStatusUpdatePreviewStep(
  ctx: ToolContext,
  input: JobsStatusUpdateInput,
): Promise<PreviewStepResult> {
  const parsed = jobsStatusUpdateSchema.parse(input);
  const job = await getScopedJobForAi(ctx.tenantId, parsed.jobId);

  if (!canTransition(job.status, parsed.newStatus)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Nao e possivel mover de ${job.status} para ${parsed.newStatus} diretamente`,
    });
  }

  const preview: CommandPreview = {
    title: `Atualizar status da ${job.code}`,
    summary: 'Confirme a mudanca de status da OS antes de executar.',
    details: [
      { label: 'OS', value: `${job.code} (#${job.id})` },
      { label: 'Cliente', value: job.clientName ?? 'Nao informado' },
      { label: 'Status atual', value: job.status },
      { label: 'Novo status', value: parsed.newStatus },
      ...(parsed.note ? [{ label: 'Observacao', value: parsed.note }] : []),
    ],
  };

  return {
    step: {
      type: 'review',
      preview,
    },
    preview,
    resolvedInput: {
      jobId: parsed.jobId,
      newStatus: parsed.newStatus,
      notes: parsed.note,
      cancelReason: parsed.cancelReason,
    },
  };
}

export async function executeJobsStatusUpdate(
  ctx: ToolContext,
  input: JobsStatusUpdateInput,
) {
  const parsed = jobsStatusUpdateSchema.parse(input);
  return jobService.changeStatus(ctx.tenantId, {
    jobId: parsed.jobId,
    newStatus: parsed.newStatus,
    notes: parsed.note,
    cancelReason: parsed.cancelReason,
  }, ctx.userId);
}
