import { and, eq, gte, ilike, inArray, isNull, lte, sql } from 'drizzle-orm';
import {
  employeesProductivitySchema,
  type EmployeesProductivityInput,
} from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { employees, jobAssignments, jobs } from '../../../db/schema/index.js';
import type { ToolContext } from '../tool-executor.js';
import { resolvePeriod } from '../resolvers.js';

type MetricRow = {
  employeeId: number;
  employeeName: string;
  jobsCompleted: number;
  valueProducedCents: number;
  avgHoursPerJob: number;
};

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function maskEmployeeName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  const parts = clean.split(' ');
  if (parts.length === 1) return parts[0]!;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${first} ${last[0]}.`;
}

async function resolveEmployeeIdByName(tenantId: number, name: string) {
  const matches = await db
    .select({
      id: employees.id,
      name: employees.name,
    })
    .from(employees)
    .where(and(
      eq(employees.tenantId, tenantId),
      isNull(employees.deletedAt),
      eq(employees.isActive, true),
      ilike(employees.name, `%${name}%`),
    ))
    .limit(6);

  if (matches.length === 0) {
    return { status: 'not_found' as const };
  }

  if (matches.length === 1) {
    return { status: 'resolved' as const, employeeId: matches[0]!.id };
  }

  return {
    status: 'ambiguous' as const,
    candidates: matches.map((item) => ({
      id: item.id,
      name: maskEmployeeName(item.name),
    })),
  };
}

async function queryProductivityRows(
  ctx: ToolContext,
  startDate: string,
  endDate: string,
  employeeId?: number | null,
): Promise<MetricRow[]> {
  const conditions = [
    eq(jobAssignments.tenantId, ctx.tenantId),
    eq(jobs.tenantId, ctx.tenantId),
    eq(employees.tenantId, ctx.tenantId),
    isNull(jobs.deletedAt),
    isNull(employees.deletedAt),
    eq(employees.isActive, true),
    inArray(jobs.status, ['ready', 'delivered']),
    gte(jobs.completedAt, new Date(startDate)),
    lte(jobs.completedAt, new Date(endDate)),
  ];

  if (employeeId) {
    conditions.push(eq(employees.id, employeeId));
  }

  const rows = await db
    .select({
      employeeId: employees.id,
      employeeName: employees.name,
      jobsCompleted: sql<number>`count(distinct ${jobs.id})`,
      valueProducedCents: sql<number>`coalesce(sum(${jobs.totalCents}), 0)`,
      avgHoursPerJob: sql<number>`
        coalesce(
          avg(extract(epoch from (${jobs.completedAt} - ${jobs.createdAt})) / 3600.0),
          0
        )
      `,
    })
    .from(jobAssignments)
    .innerJoin(employees, and(
      eq(employees.id, jobAssignments.employeeId),
      eq(employees.tenantId, ctx.tenantId),
    ))
    .innerJoin(jobs, and(
      eq(jobs.id, jobAssignments.jobId),
      eq(jobs.tenantId, ctx.tenantId),
    ))
    .where(and(...conditions))
    .groupBy(employees.id, employees.name)
    .orderBy(sql`count(distinct ${jobs.id}) desc`, sql`sum(${jobs.totalCents}) desc`);

  return rows.map((row) => ({
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    jobsCompleted: Number(row.jobsCompleted ?? 0),
    valueProducedCents: Number(row.valueProducedCents ?? 0),
    avgHoursPerJob: Number(toNumber(row.avgHoursPerJob).toFixed(2)),
  }));
}

export async function executeEmployeesProductivity(
  ctx: ToolContext,
  input: EmployeesProductivityInput,
) {
  const parsed = employeesProductivitySchema.parse(input);
  const period = resolvePeriod(parsed.period);
  let employeeId = parsed.employeeId ?? undefined;

  if (!employeeId && parsed.employeeName) {
    const resolved = await resolveEmployeeIdByName(ctx.tenantId, parsed.employeeName);
    if (resolved.status === 'not_found') {
      return {
        status: 'not_found',
        message: `Funcionario "${parsed.employeeName}" nao encontrado.`,
      };
    }
    if (resolved.status === 'ambiguous') {
      return {
        status: 'ambiguous',
        message: 'Encontrei mais de um funcionario com esse nome.',
        candidates: resolved.candidates,
      };
    }
    employeeId = resolved.employeeId;
  }

  const rows = await queryProductivityRows(
    ctx,
    period.startDate,
    period.endDate,
    employeeId,
  );

  if (rows.length === 0) {
    return {
      status: 'ok',
      period,
      metric: parsed.metric,
      employees: [],
      message: 'Nao ha producao concluida no periodo informado.',
    };
  }

  const teamTotals = rows.reduce((acc, row) => ({
    jobsCompleted: acc.jobsCompleted + row.jobsCompleted,
    valueProducedCents: acc.valueProducedCents + row.valueProducedCents,
    avgHoursPerJob: acc.avgHoursPerJob + row.avgHoursPerJob,
  }), { jobsCompleted: 0, valueProducedCents: 0, avgHoursPerJob: 0 });

  const teamAverage = {
    jobsCompleted: Number((teamTotals.jobsCompleted / rows.length).toFixed(2)),
    valueProducedCents: Math.round(teamTotals.valueProducedCents / rows.length),
    avgHoursPerJob: Number((teamTotals.avgHoursPerJob / rows.length).toFixed(2)),
  };

  const employeesOutput = rows.map((row) => ({
    employeeId: row.employeeId,
    employeeName: maskEmployeeName(row.employeeName),
    jobsCompleted: row.jobsCompleted,
    valueProducedCents: row.valueProducedCents,
    avgHoursPerJob: row.avgHoursPerJob,
  }));

  const ranking = [...employeesOutput].sort((a, b) => {
    if (parsed.metric === 'value_produced') return b.valueProducedCents - a.valueProducedCents;
    if (parsed.metric === 'avg_time_per_job') return a.avgHoursPerJob - b.avgHoursPerJob;
    return b.jobsCompleted - a.jobsCompleted;
  });

  return {
    status: 'ok',
    period,
    metric: parsed.metric,
    teamAverage,
    employees: employeesOutput,
    ranking: ranking.slice(0, 5),
  };
}
