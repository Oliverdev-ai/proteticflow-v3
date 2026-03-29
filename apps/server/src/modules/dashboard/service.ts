import { eq, and, isNull, lt, gte, lte, inArray, not, sql, count, sum } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { accountsReceivable, accountsPayable, financialClosings } from '../../db/schema/financials.js';
import { jobs, jobItems } from '../../db/schema/jobs.js';
import { clients } from '../../db/schema/clients.js';
import { materials } from '../../db/schema/materials.js';
import { employees, commissionPayments, jobAssignments } from '../../db/schema/employees.js';
import { deliverySchedules, deliveryItems } from '../../db/schema/deliveries.js';
import type {
  DashboardSummary,
  FinancialKpis,
  JobKpis,
  ClientKpis,
  InventoryKpis,
  EmployeeKpis,
  RecentJob,
  TodayDeliveries,
  MonthRevenue,
  ServiceDistribution,
  JobsTrend,
  SparklineData,
  DashboardSparklines,
} from '@proteticflow/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trendFromPoints(points: number[]): SparklineData {
  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  const changePercent =
    first === 0 ? 0 : Math.round(((last - first) / first) * 1000) / 10;
  const trend: SparklineData['trend'] =
    changePercent > 1 ? 'up' : changePercent < -1 ? 'down' : 'neutral';
  return { points, trend, changePercent };
}

// ─── 19.01 — Financeiro ───────────────────────────────────────────────────────

async function getFinancialKpis(tenantId: number, startOfMonth: Date): Promise<FinancialKpis> {
  const now = new Date();

  const [pendingArResult, overdueArResult, monthRevenueResult, monthExpensesResult] =
    await Promise.all([
      db
        .select({ total: sum(accountsReceivable.amountCents) })
        .from(accountsReceivable)
        .where(
          and(
            eq(accountsReceivable.tenantId, tenantId),
            eq(accountsReceivable.status, 'pending'),
            gte(accountsReceivable.dueDate, now),
          ),
        ),
      db
        .select({ total: sum(accountsReceivable.amountCents) })
        .from(accountsReceivable)
        .where(
          and(
            eq(accountsReceivable.tenantId, tenantId),
            sql`(${accountsReceivable.status} = 'overdue' OR (${accountsReceivable.status} = 'pending' AND ${accountsReceivable.dueDate} < ${now}))`,
          ),
        ),
      db
        .select({ total: sum(accountsReceivable.amountCents) })
        .from(accountsReceivable)
        .where(
          and(
            eq(accountsReceivable.tenantId, tenantId),
            eq(accountsReceivable.status, 'paid'),
            gte(accountsReceivable.paidAt, startOfMonth),
          ),
        ),
      db
        .select({ total: sum(accountsPayable.amountCents) })
        .from(accountsPayable)
        .where(
          and(
            eq(accountsPayable.tenantId, tenantId),
            eq(accountsPayable.status, 'paid'),
            gte(accountsPayable.paidAt, startOfMonth),
          ),
        ),
    ]);

  const monthRevenueCents = Number(monthRevenueResult[0]?.total ?? 0);
  const monthExpensesCents = Number(monthExpensesResult[0]?.total ?? 0);

  return {
    pendingArCents: Number(pendingArResult[0]?.total ?? 0),
    overdueArCents: Number(overdueArResult[0]?.total ?? 0),
    monthRevenueCents,
    monthExpensesCents,
    cashFlowCents: monthRevenueCents - monthExpensesCents,
  };
}

// ─── 19.02 — Trabalhos ────────────────────────────────────────────────────────

async function getJobKpis(tenantId: number, now: Date): Promise<JobKpis> {
  const [activeResult, completedResult, overdueResult, pendingResult] = await Promise.all([
    db
      .select({ total: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, tenantId),
          inArray(jobs.status, ['pending', 'in_progress', 'quality_check']),
          isNull(jobs.deletedAt),
        ),
      ),
    db
      .select({ total: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, tenantId),
          inArray(jobs.status, ['ready', 'delivered']),
          isNull(jobs.deletedAt),
        ),
      ),
    db
      .select({ total: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, tenantId),
          not(inArray(jobs.status, ['delivered', 'cancelled'])),
          lt(jobs.deadline, now),
          isNull(jobs.deletedAt),
        ),
      ),
    db
      .select({ total: count() })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, tenantId),
          eq(jobs.status, 'pending'),
          isNull(jobs.deletedAt),
        ),
      ),
  ]);

  return {
    active: Number(activeResult[0]?.total ?? 0),
    completed: Number(completedResult[0]?.total ?? 0),
    overdue: Number(overdueResult[0]?.total ?? 0),
    pending: Number(pendingResult[0]?.total ?? 0),
  };
}

// ─── 19.03 — Clientes (com campo active) ─────────────────────────────────────

async function getClientKpis(tenantId: number, startOfMonth: Date): Promise<ClientKpis> {
  const [totalResult, activeResult, newThisMonthResult] = await Promise.all([
    db
      .select({ total: count() })
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), isNull(clients.deletedAt))),
    db
      .select({ total: count() })
      .from(clients)
      .where(
        and(
          eq(clients.tenantId, tenantId),
          eq(clients.status, 'active'),
          isNull(clients.deletedAt),
        ),
      ),
    db
      .select({ total: count() })
      .from(clients)
      .where(
        and(
          eq(clients.tenantId, tenantId),
          gte(clients.createdAt, startOfMonth),
          isNull(clients.deletedAt),
        ),
      ),
  ]);

  return {
    total: Number(totalResult[0]?.total ?? 0),
    active: Number(activeResult[0]?.total ?? 0),
    newThisMonth: Number(newThisMonthResult[0]?.total ?? 0),
  };
}

// ─── 19.04 — Estoque ──────────────────────────────────────────────────────────

async function getInventoryKpis(tenantId: number): Promise<InventoryKpis> {
  const [totalResult, belowMinResult, valueResult] = await Promise.all([
    db
      .select({ total: count() })
      .from(materials)
      .where(and(eq(materials.tenantId, tenantId), isNull(materials.deletedAt))),
    db
      .select({ total: count() })
      .from(materials)
      .where(
        and(
          eq(materials.tenantId, tenantId),
          isNull(materials.deletedAt),
          sql`${materials.currentStock} < ${materials.minStock}`,
        ),
      ),
    db
      .select({
        total: sql<string>`COALESCE(SUM(${materials.currentStock}::numeric * ${materials.averageCostCents}::numeric), 0)`,
      })
      .from(materials)
      .where(and(eq(materials.tenantId, tenantId), isNull(materials.deletedAt))),
  ]);

  return {
    totalItems: Number(totalResult[0]?.total ?? 0),
    belowMinimum: Number(belowMinResult[0]?.total ?? 0),
    totalValueCents: Math.round(Number(valueResult[0]?.total ?? 0)),
  };
}

// ─── 19.05 — Funcionários (com comissões e atribuições pendentes) ─────────────

async function getEmployeeKpis(tenantId: number, startOfMonth: Date): Promise<EmployeeKpis> {
  const [totalResult, commissionResult, pendingAssignmentsResult] = await Promise.all([
    db
      .select({ total: count() })
      .from(employees)
      .where(
        and(eq(employees.tenantId, tenantId), eq(employees.isActive, true), isNull(employees.deletedAt)),
      ),
    // Comissões com status 'pending' criadas este mês
    db
      .select({ total: sum(commissionPayments.totalCents) })
      .from(commissionPayments)
      .where(
        and(
          eq(commissionPayments.tenantId, tenantId),
          eq(commissionPayments.status, 'pending'),
          gte(commissionPayments.createdAt, startOfMonth),
        ),
      ),
    // job_assignments cujo job está ativo (não entregue/cancelado)
    db
      .select({ total: count() })
      .from(jobAssignments)
      .innerJoin(
        jobs,
        and(
          eq(jobAssignments.jobId, jobs.id),
          not(inArray(jobs.status, ['delivered', 'cancelled'])),
          isNull(jobs.deletedAt),
        ),
      )
      .where(eq(jobAssignments.tenantId, tenantId)),
  ]);

  return {
    total: Number(totalResult[0]?.total ?? 0),
    commissionPendingCents: Number(commissionResult[0]?.total ?? 0),
    pendingAssignments: Number(pendingAssignmentsResult[0]?.total ?? 0),
  };
}

// ─── 19.06 — Trabalhos recentes ───────────────────────────────────────────────

async function getRecentJobs(tenantId: number): Promise<RecentJob[]> {
  const rows = await db
    .select({
      id: jobs.id,
      code: jobs.code,
      clientName: clients.name,
      status: jobs.status,
      dueDate: jobs.deadline,
      totalCents: jobs.totalCents,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .leftJoin(clients, eq(jobs.clientId, clients.id))
    .where(and(eq(jobs.tenantId, tenantId), isNull(jobs.deletedAt)))
    .orderBy(sql`${jobs.createdAt} DESC`)
    .limit(8);

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    clientName: r.clientName ?? '—',
    status: r.status,
    dueDate: r.dueDate ? r.dueDate.toISOString() : null,
    totalCents: r.totalCents,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ─── 19.07 — Entregas de hoje ─────────────────────────────────────────────────

async function getTodayDeliveries(
  tenantId: number,
  startOfToday: Date,
  endOfToday: Date,
): Promise<TodayDeliveries> {
  const schedules = await db
    .select({ id: deliverySchedules.id })
    .from(deliverySchedules)
    .where(
      and(
        eq(deliverySchedules.tenantId, tenantId),
        gte(deliverySchedules.date, startOfToday),
        lt(deliverySchedules.date, endOfToday),
      ),
    );

  if (schedules.length === 0) {
    return { scheduled: 0, inTransit: 0, delivered: 0, failed: 0, total: 0 };
  }

  const scheduleIds = schedules.map((s) => s.id);

  const rows = await db
    .select({ status: deliveryItems.status, total: count() })
    .from(deliveryItems)
    .where(
      and(
        eq(deliveryItems.tenantId, tenantId),
        inArray(deliveryItems.scheduleId, scheduleIds),
      ),
    )
    .groupBy(deliveryItems.status);

  const counts = { scheduled: 0, inTransit: 0, delivered: 0, failed: 0 };
  for (const row of rows) {
    const n = Number(row.total);
    if (row.status === 'scheduled') counts.scheduled += n;
    else if (row.status === 'in_transit') counts.inTransit += n;
    else if (row.status === 'delivered') counts.delivered += n;
    else if (row.status === 'failed') counts.failed += n;
  }

  return {
    ...counts,
    total: counts.scheduled + counts.inTransit + counts.delivered + counts.failed,
  };
}

// ─── 19.08 — Receita mensal (BarChart) ───────────────────────────────────────

async function getMonthlyRevenue(tenantId: number, months: number): Promise<MonthRevenue[]> {
  const periods: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    periods.push(`${yyyy}-${mm}`);
  }

  const rows = await db
    .select({
      period: financialClosings.period,
      total: sum(financialClosings.totalAmountCents),
    })
    .from(financialClosings)
    .where(
      and(
        eq(financialClosings.tenantId, tenantId),
        isNull(financialClosings.clientId),
        inArray(financialClosings.period, periods),
      ),
    )
    .groupBy(financialClosings.period);

  const map = new Map(rows.map((r) => [r.period, Number(r.total ?? 0)]));

  return periods.map((period) => ({
    period,
    totalAmountCents: map.get(period) ?? 0,
  }));
}

// ─── 19.08 — Distribuição de serviços (PieChart) ─────────────────────────────

async function getServiceDistribution(
  tenantId: number,
  startOfMonth: Date,
): Promise<ServiceDistribution[]> {
  // Top 6 serviços por receita no mês corrente
  const rows = await db
    .select({
      name: jobItems.serviceNameSnapshot,
      totalCents: sql<string>`SUM(${jobItems.totalCents})`,
    })
    .from(jobItems)
    .innerJoin(
      jobs,
      and(
        eq(jobItems.jobId, jobs.id),
        eq(jobs.tenantId, tenantId),
        gte(jobs.createdAt, startOfMonth),
        isNull(jobs.deletedAt),
      ),
    )
    .where(eq(jobItems.tenantId, tenantId))
    .groupBy(jobItems.serviceNameSnapshot)
    .orderBy(sql`SUM(${jobItems.totalCents}) DESC`)
    .limit(6);

  return rows.map((r) => ({
    name: r.name,
    totalCents: Number(r.totalCents ?? 0),
  }));
}

// ─── 19.08 — Tendência de trabalhos (LineChart) ───────────────────────────────

async function getJobsTrend(tenantId: number, months: number): Promise<JobsTrend[]> {
  const periods: string[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    periods.push(`${yyyy}-${mm}`);
  }

  // jobs criados por mês e jobs entregues por mês
  const [createdRows, deliveredRows] = await Promise.all([
    db
      .select({
        period: sql<string>`TO_CHAR(${jobs.createdAt}, 'YYYY-MM')`,
        total: count(),
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, tenantId),
          isNull(jobs.deletedAt),
          gte(jobs.createdAt, new Date(now.getFullYear(), now.getMonth() - months + 1, 1)),
        ),
      )
      .groupBy(sql`TO_CHAR(${jobs.createdAt}, 'YYYY-MM')`),
    db
      .select({
        period: sql<string>`TO_CHAR(${jobs.deliveredAt}, 'YYYY-MM')`,
        total: count(),
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, tenantId),
          eq(jobs.status, 'delivered'),
          isNull(jobs.deletedAt),
          gte(jobs.deliveredAt, new Date(now.getFullYear(), now.getMonth() - months + 1, 1)),
        ),
      )
      .groupBy(sql`TO_CHAR(${jobs.deliveredAt}, 'YYYY-MM')`),
  ]);

  const createdMap = new Map(createdRows.map((r) => [r.period, Number(r.total)]));
  const deliveredMap = new Map(deliveredRows.map((r) => [r.period, Number(r.total)]));

  return periods.map((period) => ({
    period,
    created: createdMap.get(period) ?? 0,
    delivered: deliveredMap.get(period) ?? 0,
  }));
}

// ─── 19.09 — Sparklines (série semanal, 4 semanas) ───────────────────────────

async function getSparklines(tenantId: number): Promise<DashboardSparklines> {
  const now = new Date();
  // Gera 4 semanas: [inicio_semana_3, inicio_semana_2, inicio_semana_1, inicio_semana_0]
  const weeks: Array<{ start: Date; end: Date }> = [];
  for (let i = 3; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7 - 6, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7, 23, 59, 59, 999);
    weeks.push({ start, end });
  }

  // Revenue por semana (AR pago)
  const revenueRows = await db
    .select({ paidAt: accountsReceivable.paidAt, amountCents: accountsReceivable.amountCents })
    .from(accountsReceivable)
    .where(
      and(
        eq(accountsReceivable.tenantId, tenantId),
        eq(accountsReceivable.status, 'paid'),
        gte(accountsReceivable.paidAt, weeks[0]!.start),
        lte(accountsReceivable.paidAt, weeks[3]!.end),
      ),
    );

  // Jobs criados por semana
  const jobsRows = await db
    .select({ createdAt: jobs.createdAt })
    .from(jobs)
    .where(
      and(
        eq(jobs.tenantId, tenantId),
        isNull(jobs.deletedAt),
        gte(jobs.createdAt, weeks[0]!.start),
        lte(jobs.createdAt, weeks[3]!.end),
      ),
    );

  // Novos clientes por semana
  const clientsRows = await db
    .select({ createdAt: clients.createdAt })
    .from(clients)
    .where(
      and(
        eq(clients.tenantId, tenantId),
        isNull(clients.deletedAt),
        gte(clients.createdAt, weeks[0]!.start),
        lte(clients.createdAt, weeks[3]!.end),
      ),
    );

  const revenuePoints = weeks.map(({ start, end }) =>
    revenueRows
      .filter((r) => r.paidAt && r.paidAt >= start && r.paidAt <= end)
      .reduce((acc, r) => acc + r.amountCents, 0),
  );

  const jobPoints = weeks.map(({ start, end }) =>
    jobsRows.filter((r) => r.createdAt >= start && r.createdAt <= end).length,
  );

  const clientPoints = weeks.map(({ start, end }) =>
    clientsRows.filter((r) => r.createdAt >= start && r.createdAt <= end).length,
  );

  return {
    revenue: trendFromPoints(revenuePoints),
    activeJobs: trendFromPoints(jobPoints),
    newClients: trendFromPoints(clientPoints),
  };
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function getDashboardSummary(tenantId: number): Promise<DashboardSummary> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [
    financial,
    jobKpis,
    clientKpis,
    inventoryKpis,
    employeeKpis,
    recentJobs,
    todayDeliveries,
    monthlyRevenue,
    serviceDistribution,
    jobsTrend,
    sparklines,
  ] = await Promise.all([
    getFinancialKpis(tenantId, startOfMonth),
    getJobKpis(tenantId, now),
    getClientKpis(tenantId, startOfMonth),
    getInventoryKpis(tenantId),
    getEmployeeKpis(tenantId, startOfMonth),
    getRecentJobs(tenantId),
    getTodayDeliveries(tenantId, startOfToday, endOfToday),
    getMonthlyRevenue(tenantId, 6),
    getServiceDistribution(tenantId, startOfMonth),
    getJobsTrend(tenantId, 6),
    getSparklines(tenantId),
  ]);

  return {
    financial,
    jobs: jobKpis,
    clients: clientKpis,
    inventory: inventoryKpis,
    employees: employeeKpis,
    recentJobs,
    todayDeliveries,
    charts: { monthlyRevenue, serviceDistribution, jobsTrend },
    sparklines,
    generatedAt: new Date().toISOString(),
  };
}

// Re-export subqueries for testing
export {
  getFinancialKpis,
  getJobKpis,
  getClientKpis,
  getInventoryKpis,
  getEmployeeKpis,
  getRecentJobs,
  getTodayDeliveries,
  getMonthlyRevenue,
  getServiceDistribution,
  getJobsTrend,
  getSparklines,
};
