import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/index.js';
import { users, tenants, tenantMembers } from '../../db/schema/index.js';
import { jobs, jobItems, jobLogs, orderCounters } from '../../db/schema/jobs.js';
import { clients, priceItems, pricingTables } from '../../db/schema/clients.js';
import { accountsReceivable, accountsPayable, cashbookEntries, financialClosings } from '../../db/schema/financials.js';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import * as financialService from './service.js';
import * as jobService from '../jobs/service.js';

async function createTestUser(email: string) {
  const [u] = await db.insert(users).values({
    name: 'Test', email, passwordHash: await hashPassword('Test123!'), role: 'user',
  }).returning();
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
  await db.delete(financialClosings);
  await db.delete(cashbookEntries);
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

describe('Financial Service — AR', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. AR criado automaticamente ao criar OS (via createJob)', async () => {
    const user = await createTestUser('f1@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F1');
    const client = await createTestClient(tenant.id, user.id);
    
    const job = await jobService.createJob(tenant.id, {
      clientId: client.id,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      items: [{ serviceNameSnapshot: 'Item A', quantity: 1, unitPriceCents: 15000, adjustmentPercent: 0 }],
    }, user.id);
    if (!job) throw new Error('Falha ao criar job de teste');

    const ars = await db.select().from(accountsReceivable).where(eq(accountsReceivable.jobId, job.id));
    expect(ars.length).toBe(1);                   // Test 1: AR criado
    expect(ars[0]?.amountCents).toBe(15000);      // Test 2: AR.amountCents === job.totalCents (froz AP-02)
    expect(ars[0]?.status).toBe('pending');       // Test 2: status inicial
    expect(ars[0]?.jobId).toBe(job.id);           // Test 2: vinculado à OS correta
  });

  it('3. Listar AR — filtra por tenant (isolamento)', async () => {
    const u1 = await createTestUser('f3a@test.com');
    const u2 = await createTestUser('f3b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab F3A');
    const t2 = await createTestTenant(u2.id, 'Lab F3B');
    const c1 = await createTestClient(t1.id, u1.id);

    await financialService.createAr(t1.id, { clientId: c1.id, jobId: 0, amountCents: 5000, dueDate: new Date(Date.now() + 86400000).toISOString() });
    await financialService.createAr(t2.id, { clientId: c1.id, jobId: 0, amountCents: 10000, dueDate: new Date(Date.now() + 86400000).toISOString() });

    const { data } = await financialService.listAr(t1.id, { limit: 20 });
    expect(data.length).toBe(1);
    expect(data[0]?.ar.amountCents).toBe(5000);
  });

  it('4. Listar AR — filtra por status', async () => {
    const u1 = await createTestUser('f4@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab F4');
    const c1 = await createTestClient(t1.id, u1.id);

    const ar = await financialService.createAr(t1.id, { clientId: c1.id, jobId: 0, amountCents: 5000, dueDate: new Date(Date.now() + 86400000).toISOString() });
    await financialService.createAr(t1.id, { clientId: c1.id, jobId: 0, amountCents: 3000, dueDate: new Date(Date.now() + 86400000).toISOString() });
    await financialService.markArPaid(t1.id, { id: ar.id }, u1.id);

    const { data } = await financialService.listAr(t1.id, { status: 'pending', limit: 20 });
    expect(data.length).toBe(1);
    expect(data[0]?.ar.amountCents).toBe(3000);
  });

  it('5. Listar AR — filtra por período', async () => {
    const u1 = await createTestUser('f5@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab F5');
    const c1 = await createTestClient(t1.id, u1.id);
    const now = new Date();
    const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    await financialService.createAr(t1.id, { clientId: c1.id, jobId: 0, amountCents: 7000, dueDate: now.toISOString() });
    await financialService.createAr(t1.id, { clientId: c1.id, jobId: 0, amountCents: 9000, dueDate: nextYear.toISOString() });

    const { data } = await financialService.listAr(t1.id, {
      dateTo: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      limit: 20,
    });
    expect(data.length).toBe(1);
    expect(data[0]?.ar.amountCents).toBe(7000);
  });

  it('6 & 7 & 19. Marcar AR como pago — status paid, paidAt preenchido e credit cashbook na transacao', async () => {
    const user = await createTestUser('f6@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F6');
    const client = await createTestClient(tenant.id, user.id);
    
    const ar = await financialService.createAr(tenant.id, {
      clientId: client.id,
      jobId: 0,
      amountCents: 12000,
      dueDate: new Date(Date.now() + 86400000).toISOString()
    });

    const updated = await financialService.markArPaid(tenant.id, { id: ar.id, paymentMethod: 'PIX', notes: 'Pago' }, user.id);

    // Test 7: status paid e paidAt preenchido
    expect(updated.status).toBe('paid');
    expect(updated.paidAt).not.toBeNull();
    expect(updated.paymentMethod).toBe('PIX');

    // Test 6 & 19: pagamento AR gera entrada credit no cashbook (AP-14)
    const cb = await db.select().from(cashbookEntries).where(eq(cashbookEntries.arId, ar.id));
    expect(cb.length).toBe(1);                             // Test 19: entrada criada
    expect(cb[0]?.type).toBe('credit');                   // Test 19: tipo credit
    expect(cb[0]?.amountCents).toBe(12000);               // Test 6: valor idêntico ao AR
    expect(cb[0]?.category).toBe('pagamento_os');         // Test 6: categoria correta
    expect(cb[0]?.tenantId).toBe(tenant.id);              // Isolamento
  });

  it('8. Cancelar AR — exige motivo', async () => {
    const user = await createTestUser('f8@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F8');
    const client = await createTestClient(tenant.id, user.id);
    
    const ar = await financialService.createAr(tenant.id, {
      clientId: client.id,
      jobId: 0,
      amountCents: 8000,
      dueDate: new Date(Date.now() + 86400000).toISOString()
    });

    const cancelled = await financialService.cancelAr(tenant.id, { id: ar.id, cancelReason: 'Erro' }, user.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelReason).toBe('Erro');
  });

  it('9. Cancelar AR pago — REJEITADO', async () => {
    const user = await createTestUser('f9@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F9');
    const client = await createTestClient(tenant.id, user.id);
    
    const ar = await financialService.createAr(tenant.id, {
      clientId: client.id,
      jobId: 0,
      amountCents: 8000,
      dueDate: new Date(Date.now() + 86400000).toISOString()
    });

    await financialService.markArPaid(tenant.id, { id: ar.id }, user.id);

    await expect(financialService.cancelAr(tenant.id, { id: ar.id, cancelReason: 'Erro' }, user.id))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('10. Tenant isolation — AR de tenant A invisível para B', async () => {
    const u1 = await createTestUser('f10a@test.com');
    const u2 = await createTestUser('f10b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab F10A');
    const t2 = await createTestTenant(u2.id, 'Lab F10B');
    const c1 = await createTestClient(t1.id, u1.id);
    
    await financialService.createAr(t1.id, {
      clientId: c1.id,
      jobId: 0,
      amountCents: 5000,
      dueDate: new Date(Date.now() + 86400000).toISOString()
    });

    const { data } = await financialService.listAr(t2.id, { limit: 20 });
    expect(data.length).toBe(0);
  });
});

describe('Financial Service — AP', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('11. Criar AP — retorna com tenantId', async () => {
    const user = await createTestUser('f11@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F11');
    
    const ap = await financialService.createAp(tenant.id, {
      description: 'Conta Luz',
      amountCents: 15000,
      dueDate: new Date(Date.now() + 86400000).toISOString()
    }, user.id);

    expect(ap.id).toBeGreaterThan(0);
    expect(ap.tenantId).toBe(tenant.id);
  });

  it('12. Marcar AP como pago — cria entrada no cashbook (debit) na mesma transação', async () => {
    const user = await createTestUser('f12@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F12');
    
    const ap = await financialService.createAp(tenant.id, {
      description: 'Conta Luz',
      amountCents: 15000,
      dueDate: new Date(Date.now() + 86400000).toISOString()
    }, user.id);

    const updated = await financialService.markApPaid(tenant.id, { id: ap.id, paymentMethod: 'Boleto' }, user.id);
    expect(updated.status).toBe('paid');

    const cb = await db.select().from(cashbookEntries).where(eq(cashbookEntries.apId, ap.id));
    expect(cb.length).toBe(1);
    expect(cb[0]?.type).toBe('debit');
    expect(cb[0]?.amountCents).toBe(15000);
  });

  it('13. Cancelar AP — exige motivo', async () => {
    const user = await createTestUser('f13@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F13');
    
    const ap = await financialService.createAp(tenant.id, {
      description: 'Conta Luz',
      amountCents: 15000,
      dueDate: new Date(Date.now() + 86400000).toISOString()
    }, user.id);

    const cancelled = await financialService.cancelAp(tenant.id, { id: ap.id, cancelReason: 'Duplicado' }, user.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelReason).toBe('Duplicado');
  });
});

describe('Financial Service — Fechamento', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('14. Gerar fechamento mensal — totalAmount = soma ARs do período e 16. RECONCILIAÇÃO', async () => {
    const user = await createTestUser('f14@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F14');
    const client = await createTestClient(tenant.id, user.id);
    
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await financialService.createAr(tenant.id, {
      clientId: client.id, jobId: 0, amountCents: 10000, dueDate: now.toISOString()
    });
    const ar2 = await financialService.createAr(tenant.id, {
      clientId: client.id, jobId: 0, amountCents: 5000, dueDate: now.toISOString()
    });
    await financialService.markArPaid(tenant.id, { id: ar2.id, paymentMethod: 'PIX', notes: '' }, user.id);

    const closing = await financialService.generateMonthlyClosing(tenant.id, { period }, user.id);

    expect(closing.totalAmountCents).toBe(15000);
    expect(closing.paidAmountCents).toBe(5000);
    expect(closing.pendingAmountCents).toBe(10000);
    expect(closing.totalJobs).toBe(0);
  });

  it('15. Fechamento por cliente — filtra corretamente', async () => {
    const user = await createTestUser('f15@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F15');
    const c1 = await createTestClient(tenant.id, user.id, 'C1');
    const c2 = await createTestClient(tenant.id, user.id, 'C2');
    
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await financialService.createAr(tenant.id, { clientId: c1.id, jobId: 0, amountCents: 10000, dueDate: now.toISOString() });
    await financialService.createAr(tenant.id, { clientId: c2.id, jobId: 0, amountCents: 20000, dueDate: now.toISOString() });

    const closingC1 = await financialService.generateMonthlyClosing(tenant.id, { period, clientId: c1.id }, user.id);
    expect(closingC1.totalAmountCents).toBe(10000);

    const closingGlobal = await financialService.generateMonthlyClosing(tenant.id, { period }, user.id);
    expect(closingGlobal.totalAmountCents).toBe(30000);
  });
});

describe('Financial Service — Livro Caixa', () => {
  beforeEach(cleanup);
  afterEach(cleanup);
  
  it('17. Entrada manual e 18. Saldo acumulado', async () => {
    const user = await createTestUser('f17@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F17');
    
    await financialService.createManualCashbookEntry(tenant.id, {
      type: 'credit', amountCents: 5000, description: 'Depósito', referenceDate: new Date().toISOString()
    }, user.id);
    
    await financialService.createManualCashbookEntry(tenant.id, {
      type: 'debit', amountCents: 2000, description: 'Material', referenceDate: new Date().toISOString()
    }, user.id);

    const { balance } = await financialService.listCashbook(tenant.id, { page: 1, limit: 10 });
    expect(balance.totalCredits).toBe(5000);
    expect(balance.totalDebits).toBe(2000);
    expect(balance.netBalance).toBe(3000);
  });
});

describe('Financial Service — Relatórios', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('20. Annual balance', async () => {
    const user = await createTestUser('f20@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F20');
    const client = await createTestClient(tenant.id, user.id);

    await db.insert(accountsReceivable).values({
      tenantId: tenant.id, jobId: 0, clientId: client.id, amountCents: 10000, dueDate: new Date(2026, 0, 15), status: 'paid', paidAt: new Date(2026, 0, 16)
    });
    
    await db.insert(accountsPayable).values({
      tenantId: tenant.id, description: 'Despesa', amountCents: 4000, dueDate: new Date(2026, 0, 15), status: 'paid', paidAt: new Date(2026, 0, 16)
    });

    const balance = await financialService.getAnnualBalance(tenant.id, { year: 2026 });
    expect(balance.quarters[0]?.revenue).toBe(10000);
    expect(balance.quarters[0]?.expenses).toBe(4000);
    expect(balance.quarters[0]?.profit).toBe(6000);
    expect(balance.quarters[0]?.margin).toBe(60);
  });

  it('21. Payer ranking', async () => {
    const user = await createTestUser('f21@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F21');
    const c1 = await createTestClient(tenant.id, user.id, 'C1');
    const c2 = await createTestClient(tenant.id, user.id, 'C2');

    await db.insert(accountsReceivable).values({
      tenantId: tenant.id, jobId: 0, clientId: c1.id, amountCents: 20000, dueDate: new Date(2026, 0, 20), status: 'paid', paidAt: new Date(2026, 0, 19)
    });
    await db.insert(accountsReceivable).values({
      tenantId: tenant.id, jobId: 0, clientId: c2.id, amountCents: 50000, dueDate: new Date(2026, 0, 20), status: 'paid', paidAt: new Date(2026, 0, 25)
    });

    const rank = await financialService.getPayerRanking(tenant.id, { limit: 10 });
    expect(rank[0]?.clientId).toBe(c2.id);
    expect(rank[0]?.totalPaidCents).toBe(50000);
    expect(rank[0]?.onTimePercent).toBe(0);
    
    expect(rank[1]?.clientId).toBe(c1.id);
    expect(rank[1]?.totalPaidCents).toBe(20000);
    expect(rank[1]?.onTimePercent).toBe(100);
  });
  
  it('22. Cash flow', async () => {
    const user = await createTestUser('f22@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F22');
    
    await financialService.createManualCashbookEntry(tenant.id, {
      type: 'credit', amountCents: 3000, description: 'Depósito', referenceDate: new Date('2026-03-10T12:00:00Z').toISOString()
    }, user.id);

    const cf = await financialService.getCashFlow(tenant.id, { dateFrom: new Date('2026-01-01').toISOString(), dateTo: new Date('2026-12-31').toISOString() });
    
    const mar = cf.months.find(m => m.month === '2026-03');
    expect(mar).toBeDefined();
    expect(mar?.credits).toBe(3000);
  });
});

describe('Financial Service — Cron', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('23. Overdue updater', async () => {
    const user = await createTestUser('f23@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F23');
    const client = await createTestClient(tenant.id, user.id);

    const pastDate = new Date(Date.now() - 86400000);
    const [ar] = await db.insert(accountsReceivable).values({
      tenantId: tenant.id, jobId: 0, clientId: client.id, amountCents: 1000, dueDate: pastDate, status: 'pending'
    }).returning();
    if (!ar) throw new Error('Falha ao criar AR de teste');

    const { overdueReminders } = await import('../../cron/overdue-reminders.js');
    await overdueReminders();

    const [updated] = await db.select().from(accountsReceivable).where(eq(accountsReceivable.id, ar.id));
    expect(updated?.status).toBe('overdue');
  });

  it('24. Monthly closing automátivo via cron', async () => {
    const user = await createTestUser('f24@test.com');
    const tenant = await createTestTenant(user.id, 'Lab F24');
    const client = await createTestClient(tenant.id, user.id);

    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    lastMonth.setDate(15);
    
    await db.insert(accountsReceivable).values({
      tenantId: tenant.id, jobId: 0, clientId: client.id, amountCents: 1000, dueDate: lastMonth, status: 'pending'
    });

    const { monthlyClosing } = await import('../../cron/monthly-closing.js');
    await monthlyClosing();

    const closings = await db.select().from(financialClosings).where(eq(financialClosings.tenantId, tenant.id));
    expect(closings.length).toBe(1);
    expect(closings[0]?.totalAmountCents).toBe(1000);
  });
});

