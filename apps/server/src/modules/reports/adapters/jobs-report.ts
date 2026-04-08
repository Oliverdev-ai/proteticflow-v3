import { and, eq, gte, lte, isNull } from 'drizzle-orm';
import type { ReportPreviewResult } from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { jobs, clients } from '../../../db/schema/index.js';

type Filters = {
  dateFrom: string;
  dateTo: string;
  clientId?: number;
};

export async function buildJobsByPeriodReport(tenantId: number, filters: Filters): Promise<ReportPreviewResult> {
  const conditions = [
    eq(jobs.tenantId, tenantId),
    isNull(jobs.deletedAt),
    gte(jobs.createdAt, new Date(filters.dateFrom)),
    lte(jobs.createdAt, new Date(filters.dateTo)),
  ];

  if (filters.clientId) {
    conditions.push(eq(jobs.clientId, filters.clientId));
  }

  const rows = await db
    .select({
      jobId: jobs.id,
      code: jobs.code,
      clientName: clients.name,
      status: jobs.status,
      createdAt: jobs.createdAt,
      deadline: jobs.deadline,
      deliveredAt: jobs.deliveredAt,
      totalCents: jobs.totalCents,
    })
    .from(jobs)
    .leftJoin(clients, eq(clients.id, jobs.clientId))
    .where(and(...conditions));

  return {
    type: 'jobs_by_period',
    title: 'Trabalhos por Periodo',
    generatedAt: new Date().toISOString(),
    summary: {
      totalJobs: rows.length,
      totalCents: rows.reduce((acc, row) => acc + row.totalCents, 0),
    },
    columns: ['jobId', 'code', 'clientName', 'status', 'createdAt', 'deadline', 'deliveredAt', 'totalCents'],
    rows: rows.map((row) => ({
      jobId: row.jobId,
      code: row.code,
      clientName: row.clientName ?? '-',
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      deadline: row.deadline.toISOString(),
      deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
      totalCents: row.totalCents,
    })),
  };
}
