import { eq, and, isNull, lt, gte, inArray, not, sql, count, sum } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { accountsReceivable, accountsPayable, financialClosings } from '../../db/schema/financials.js';
import { jobs } from '../../db/schema/jobs.js';
import { clients } from '../../db/schema/clients.js';
import { materials } from '../../db/schema/materials.js';
import { employees } from '../../db/schema/employees.js';
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
} from '@proteticflow/shared';

// ─── Subqueries ────────────────────────────────────────────────────────────────

async function getFinancialKpis(tenantId: number, startOfMonth: Date): Promise<FinancialKpis> {
  const now = new Date();

  const [pendingArResult, overdueArResult, monthRevenueResult, monthExpensesResult] =
    await Promise.all([
      // Pendente (status = pending, não vencido)
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
      // Vencido: status overdue OU (status pending E dueDate < now)
      db
        .select({ total: sum(accountsReceivable.amountCents) })
        .from(accountsReceivable)
        .where(
          and(
            eq(accountsReceivable.tenantId, tenantId),
            sql`(${accountsReceivable.status} = 'overdue' OR (${accountsReceivable.status} = 'pending' AND ${accountsReceivable.dueDate} < ${now}))`,
          ),
        ),
      // Receita do mês: AR pagas neste mês
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
      // Despesas do mês: AP pagas neste mês
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

  const pendingArCents = Number(pendingArResult[0]?.total ?? 0);
  const overdueArCents = Number(overdueArResult[0]?.total ?? 0);
  const monthRevenueCents = Number(monthRevenueResult[0]?.total ?? 0);
  const monthExpensesCents = Number(monthExpensesResult[0]?.total ?? 0);

  return {
    pendingArCents,
    overdueArCents,
    monthRevenueCents,
    monthExpensesCents,
    cashFlowCents: monthRevenueCents - monthExpensesCents,
  };
}

async function getJobKpis(tenantId: number, now: Date): Promise<JobKpis> {
  const [activeResult, completedResult, overdueResult, pendingResult] = await Promise.all([
    // Ativos
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
    // Concluídos
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
    // Atrasados: não concluídos/cancelados E deadline < now
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
    // Pendentes
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

async function getClientKpis(tenantId: number, startOfMonth: Date): Promise<ClientKpis> {
  const [totalResult, newThisMonthResult] = await Promise.all([
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
          gte(clients.createdAt, startOfMonth),
          isNull(clients.deletedAt),
        ),
      ),
  ]);

  return {
    total: Number(totalResult[0]?.total ?? 0),
    newThisMonth: Number(newThisMonthResult[0]?.total ?? 0),
  };
}

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

async function getEmployeeKpis(tenantId: number): Promise<EmployeeKpis> {
  const [result] = await db
    .select({ total: count() })
    .from(employees)
    .where(
      and(eq(employees.tenantId, tenantId), eq(employees.isActive, true), isNull(employees.deletedAt)),
    );

  return { total: Number(result?.total ?? 0) };
}

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

async function getTodayDeliveries(
  tenantId: number,
  startOfToday: Date,
  endOfToday: Date,
): Promise<TodayDeliveries> {
  // Busca schedules de hoje
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

async function getMonthlyRevenue(tenantId: number, months: number): Promise<MonthRevenue[]> {
  // Gera os últimos N períodos (YYYY-MM) em JS
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
  ] = await Promise.all([
    getFinancialKpis(tenantId, startOfMonth),
    getJobKpis(tenantId, now),
    getClientKpis(tenantId, startOfMonth),
    getInventoryKpis(tenantId),
    getEmployeeKpis(tenantId),
    getRecentJobs(tenantId),
    getTodayDeliveries(tenantId, startOfToday, endOfToday),
    getMonthlyRevenue(tenantId, 6),
  ]);

  return {
    financial,
    jobs: jobKpis,
    clients: clientKpis,
    inventory: inventoryKpis,
    employees: employeeKpis,
    recentJobs,
    todayDeliveries,
    charts: { monthlyRevenue },
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
};
