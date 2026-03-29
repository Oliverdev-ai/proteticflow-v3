import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/index.js';
import { users, tenants, tenantMembers } from '../../db/schema/index.js';
import { jobs, jobItems, jobLogs, orderCounters } from '../../db/schema/jobs.js';
import { clients, priceItems, pricingTables } from '../../db/schema/clients.js';
import { accountsReceivable, accountsPayable, financialClosings } from '../../db/schema/financials.js';
import { materials, materialCategories, stockMovements } from '../../db/schema/materials.js';
import { employees } from '../../db/schema/employees.js';
import { deliverySchedules, deliveryItems } from '../../db/schema/deliveries.js';
import { hashPassword } from '../../core/auth.js';
import {
  getDashboardSummary,
  getFinancialKpis,
  getJobKpis,
  getClientKpis,
  getMonthlyRevenue,
} from './service.js';

async function createTestUser(email: string) {
  const [u] = await db
    .insert(users)
    .values({
      name: 'Test',
      email,
      passwordHash: await hashPassword('Test123!'),
      role: 'user',
    })
    .returning();
  return u!;
}

async function createTestTenant(userId: number, name: string) {
  const { createTenant } = await import('../tenants/service.js');
  return createTenant(userId, { name });
}

async function createTestClient(tenantId: number, userId: number, name = 'Clínica Teste') {
  const { createClient } = await import('../clients/service.js');
  const client = await createClient(tenantId, { name, priceAdjustmentPercent: 0 }, userId);
  if (!client) throw new Error('Falha ao criar cliente de teste');
  return client;
}

async function cleanup() {
  await db.delete(deliveryItems);
  await db.delete(deliverySchedules);
  await db.delete(stockMovements);
  await db.delete(materials);
  await db.delete(materialCategories);
  await db.delete(employees);
  await db.delete(financialClosings);
  await db.delete(accountsPayable);
  await db.delete(accountsReceivable);
  await db.delete(jobLogs);
  await db.delete(jobItems);
  await db.delete(jobs);
  await db.delete(orderCounters);
  await db.delete(priceItems);
  await db.delete(pricingTables);
  await db.delete(clients);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('Dashboard Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  // T01: getDashboardSummary — retorna objeto com todas as chaves esperadas
  it('T01: getDashboardSummary retorna objeto com todas as chaves esperadas', async () => {
    const user = await createTestUser('d01@test.com');
    const tenant = await createTestTenant(user.id, 'Lab D01');

    const summary = await getDashboardSummary(tenant.id);

    expect(summary).toHaveProperty('financial');
    expect(summary).toHaveProperty('jobs');
    expect(summary).toHaveProperty('clients');
    expect(summary).toHaveProperty('inventory');
    expect(summary).toHaveProperty('employees');
    expect(summary).toHaveProperty('recentJobs');
    expect(summary).toHaveProperty('todayDeliveries');
    expect(summary).toHaveProperty('charts');
    expect(summary.charts).toHaveProperty('monthlyRevenue');
    expect(summary).toHaveProperty('generatedAt');
    expect(Array.isArray(summary.recentJobs)).toBe(true);
    expect(Array.isArray(summary.charts.monthlyRevenue)).toBe(true);
  });

  // T02: getFinancialKpis — AR vencida conta como overdueAr
  it('T02: AR com status pending e dueDate no passado conta como overdueAr', async () => {
    const user = await createTestUser('d02@test.com');
    const tenant = await createTestTenant(user.id, 'Lab D02');
    const client = await createTestClient(tenant.id, user.id);

    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 dias atrás
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // AR vencida (pending + dueDate no passado)
    await db.insert(accountsReceivable).values({
      tenantId: tenant.id,
      jobId: 0,
      clientId: client.id,
      amountCents: 10000,
      dueDate: pastDate,
      status: 'pending',
    });

    // AR pendente (não vencida)
    await db.insert(accountsReceivable).values({
      tenantId: tenant.id,
      jobId: 0,
      clientId: client.id,
      amountCents: 5000,
      dueDate: futureDate,
      status: 'pending',
    });

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const kpis = await getFinancialKpis(tenant.id, startOfMonth);

    expect(kpis.overdueArCents).toBe(10000);
    expect(kpis.pendingArCents).toBe(5000);
  });

  // T03: getJobKpis — job com deadline < now e status in_progress conta como overdue
  it('T03: job com deadline passado e status in_progress conta como overdue', async () => {
    const user = await createTestUser('d03@test.com');
    const tenant = await createTestTenant(user.id, 'Lab D03');
    const client = await createTestClient(tenant.id, user.id);

    // Job atrasado
    await db.insert(jobs).values({
      tenantId: tenant.id,
      clientId: client.id,
      code: 'D03-001',
      status: 'in_progress',
      totalCents: 0,
      deadline: new Date(Date.now() - 24 * 60 * 60 * 1000), // ontem
    });

    // Job no prazo
    await db.insert(jobs).values({
      tenantId: tenant.id,
      clientId: client.id,
      code: 'D03-002',
      status: 'in_progress',
      totalCents: 0,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // amanhã
    });

    const kpis = await getJobKpis(tenant.id, new Date());

    expect(kpis.overdue).toBe(1);
    expect(kpis.active).toBe(2); // ambos ativos (in_progress)
  });

  // T04: getClientKpis — newThisMonth só conta clientes criados no mês atual
  it('T04: newThisMonth só conta clientes criados neste mês', async () => {
    const user = await createTestUser('d04@test.com');
    const tenant = await createTestTenant(user.id, 'Lab D04');

    // Cliente criado agora (neste mês)
    await db.insert(clients).values({
      tenantId: tenant.id,
      name: 'Cliente Novo',
    });

    // Cliente criado no mês passado (manualmente inserido com createdAt antigo)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    await db.insert(clients).values({
      tenantId: tenant.id,
      name: 'Cliente Antigo',
      createdAt: lastMonth,
    });

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const kpis = await getClientKpis(tenant.id, startOfMonth);

    expect(kpis.total).toBe(2);
    expect(kpis.newThisMonth).toBe(1);
  });

  // T05: getMonthlyRevenue — retorna N períodos mesmo sem closing (zero-fill)
  it('T05: getMonthlyRevenue retorna 6 períodos com zero-fill para meses sem fechamento', async () => {
    const user = await createTestUser('d05@test.com');
    const tenant = await createTestTenant(user.id, 'Lab D05');

    const revenue = await getMonthlyRevenue(tenant.id, 6);

    expect(revenue).toHaveLength(6);
    expect(revenue.every((r) => r.totalAmountCents === 0)).toBe(true);
    expect(revenue[0]?.period).toMatch(/^\d{4}-\d{2}$/);
  });

  // T06: getDashboardSummary — todas as subqueries filtram por tenantId
  it('T06: dados de outro tenant não aparecem no dashboard', async () => {
    const user1 = await createTestUser('d06a@test.com');
    const user2 = await createTestUser('d06b@test.com');
    const tenant1 = await createTestTenant(user1.id, 'Lab D06A');
    const tenant2 = await createTestTenant(user2.id, 'Lab D06B');
    const client2 = await createTestClient(tenant2.id, user2.id);

    // Dados do tenant2
    await db.insert(accountsReceivable).values({
      tenantId: tenant2.id,
      jobId: 0,
      clientId: client2.id,
      amountCents: 99999,
      dueDate: new Date(Date.now() + 86400000),
      status: 'pending',
    });

    await db.insert(jobs).values({
      tenantId: tenant2.id,
      clientId: client2.id,
      code: 'D06-001',
      status: 'in_progress',
      totalCents: 0,
      deadline: new Date(Date.now() + 86400000),
    });

    // Dashboard do tenant1 deve estar vazio
    const summary = await getDashboardSummary(tenant1.id);

    expect(summary.financial.pendingArCents).toBe(0);
    expect(summary.jobs.active).toBe(0);
    expect(summary.recentJobs).toHaveLength(0);
  });

  // T07: getSummary — executa sem erro e retorna em tempo razoável
  it('T07: getDashboardSummary executa sem erro com tenant vazio', async () => {
    const user = await createTestUser('d07@test.com');
    const tenant = await createTestTenant(user.id, 'Lab D07');

    const start = Date.now();
    const summary = await getDashboardSummary(tenant.id);
    const elapsed = Date.now() - start;

    expect(summary).toBeDefined();
    expect(elapsed).toBeLessThan(2000); // tolerância para CI
  });
});
