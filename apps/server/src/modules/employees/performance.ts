import { TRPCError } from '@trpc/server';
import { and, eq, gte, lte, sql, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { commissionPayments, employees, jobAssignments, jobs, timesheets } from '../../db/schema/index.js';
import type { EmployeePerformanceMetrics } from '@proteticflow/shared';

function monthRangeFromDate(baseDate: Date): { startDate: string; endDate: string } {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth() + 1;
  const safeMonth = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${year}-${safeMonth}-01`,
    endDate: `${year}-${safeMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function assertEmployeeAccess(tenantId: number, employeeId: number) {
  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(
      eq(employees.id, employeeId),
      eq(employees.tenantId, tenantId),
      isNull(employees.deletedAt),
    ));

  if (!employee) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Funcionario nao encontrado' });
  }
}

export async function getEmployeePerformance(
  tenantId: number,
  employeeId: number,
): Promise<EmployeePerformanceMetrics> {
  await assertEmployeeAccess(tenantId, employeeId);

  const assignedJobs = db
    .select({ jobId: jobAssignments.jobId })
    .from(jobAssignments)
    .where(and(
      eq(jobAssignments.tenantId, tenantId),
      eq(jobAssignments.employeeId, employeeId),
    ))
    .groupBy(jobAssignments.jobId)
    .as('assigned_jobs');

  const [jobMetrics] = await db
    .select({
      osCompleted: sql<number>`count(*)`,
      avgCompletionDays: sql<number>`coalesce(avg(extract(epoch from (${jobs.completedAt} - ${jobs.createdAt})) / 86400.0), 0)`,
      overdueRate: sql<number>`
        coalesce(
          case
            when count(*) = 0 then 0
            else (sum(case when ${jobs.completedAt} > ${jobs.deadline} then 1 else 0 end)::numeric / count(*)::numeric) * 100
          end,
          0
        )
      `,
    })
    .from(assignedJobs)
    .innerJoin(jobs, and(
      eq(jobs.id, assignedJobs.jobId),
      eq(jobs.tenantId, tenantId),
    ))
    .where(and(
      inArray(jobs.status, ['ready', 'delivered']),
      sql`${jobs.completedAt} is not null`,
      isNull(jobs.deletedAt),
    ));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const { startDate, endDate } = monthRangeFromDate(now);

  const [commissionRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${commissionPayments.totalCents}), 0)`,
    })
    .from(commissionPayments)
    .where(and(
      eq(commissionPayments.tenantId, tenantId),
      eq(commissionPayments.employeeId, employeeId),
      gte(commissionPayments.paidAt, monthStart),
      lte(commissionPayments.paidAt, monthEnd),
    ));

  const [hoursRow] = await db
    .select({
      totalHours: sql<number>`coalesce(sum(${timesheets.hoursWorked}), 0)`,
    })
    .from(timesheets)
    .where(and(
      eq(timesheets.tenantId, tenantId),
      eq(timesheets.employeeId, employeeId),
      gte(timesheets.date, startDate),
      lte(timesheets.date, endDate),
    ));

  return {
    osCompleted: Number(jobMetrics?.osCompleted ?? 0),
    avgCompletionDays: Number(parseNumber(jobMetrics?.avgCompletionDays).toFixed(2)),
    overdueRate: Number(parseNumber(jobMetrics?.overdueRate).toFixed(2)),
    commissionsTotalCents: Number(parseNumber(commissionRow?.total).toFixed(0)),
    hoursThisMonth: Number(parseNumber(hoursRow?.totalHours).toFixed(2)),
  };
}
