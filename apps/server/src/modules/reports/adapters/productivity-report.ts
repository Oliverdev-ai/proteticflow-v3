import { and, eq, gte, lte, isNull } from 'drizzle-orm';
import type { ReportPreviewResult } from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { jobs, jobAssignments, employees } from '../../../db/schema/index.js';

type Filters = {
  dateFrom: string;
  dateTo: string;
  employeeId?: number;
};

function hoursBetween(start: Date, end: Date) {
  return Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 100) / 100;
}

export async function buildProductivityReport(tenantId: number, filters: Filters): Promise<ReportPreviewResult> {
  const conditions = [
    eq(jobAssignments.tenantId, tenantId),
    eq(jobs.tenantId, tenantId),
    gte(jobs.createdAt, new Date(filters.dateFrom)),
    lte(jobs.createdAt, new Date(filters.dateTo)),
    isNull(jobs.deletedAt),
  ];

  if (filters.employeeId) {
    conditions.push(eq(jobAssignments.employeeId, filters.employeeId));
  }

  const rows = await db
    .select({
      employeeId: employees.id,
      employeeName: employees.name,
      jobId: jobs.id,
      status: jobs.status,
      createdAt: jobs.createdAt,
      deliveredAt: jobs.deliveredAt,
      deadline: jobs.deadline,
    })
    .from(jobAssignments)
    .innerJoin(jobs, eq(jobs.id, jobAssignments.jobId))
    .innerJoin(employees, eq(employees.id, jobAssignments.employeeId))
    .where(and(...conditions));

  const byEmployee = new Map<number, {
    employeeId: number;
    employeeName: string;
    completed: number;
    late: number;
    totalHours: number;
  }>();

  for (const row of rows) {
    const current = byEmployee.get(row.employeeId) ?? {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      completed: 0,
      late: 0,
      totalHours: 0,
    };

    const isCompleted = row.status === 'delivered' || row.status === 'ready';
    if (isCompleted) {
      current.completed += 1;
      const end = row.deliveredAt ?? new Date();
      current.totalHours += hoursBetween(row.createdAt, end);
      if (end.getTime() > row.deadline.getTime()) {
        current.late += 1;
      }
    }

    byEmployee.set(row.employeeId, current);
  }

  const resultRows = Array.from(byEmployee.values()).map((row) => {
    const avgHours = row.completed > 0 ? Number((row.totalHours / row.completed).toFixed(2)) : 0;
    const lateRate = row.completed > 0 ? Number(((row.late / row.completed) * 100).toFixed(2)) : 0;

    return {
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      completedJobs: row.completed,
      averageHours: avgHours,
      lateRatePercent: lateRate,
    };
  });

  return {
    type: 'productivity',
    title: 'Produtividade por Tecnico',
    generatedAt: new Date().toISOString(),
    summary: {
      technicians: resultRows.length,
      completedJobs: resultRows.reduce((acc, row) => acc + row.completedJobs, 0),
    },
    columns: ['employeeId', 'employeeName', 'completedJobs', 'averageHours', 'lateRatePercent'],
    rows: resultRows,
  };
}
