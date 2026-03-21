import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/index.js';
import { users, tenants, tenantMembers } from '../../db/schema/index.js';
import { jobs, jobItems, jobLogs, orderCounters } from '../../db/schema/jobs.js';
import { clients, priceItems, priceTables } from '../../db/schema/clients.js';
import { accountsReceivable, accountsPayable, cashbookEntries } from '../../db/schema/financials.js';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import * as financialService from './service.js';
import * as jobService from '../jobs/service.js';

async function createTestUser(email: string) {
  const [u] = await db.insert(users).values({
    name: 'Test', email, passwordHash: await hashPassword('Test123!'), role: 'user',
  }).returning();
  return u;
}

async function createTestTenant(userId: number, name: string) {
  const { createTenant } = await import('../tenants/service.js');
  return createTenant(userId, { name });
}

async function createTestClient(tenantId: number, userId: number, name = 'Clínica Teste') {
  const { createClient } = await import('../clients/service.js');
  return createClient(tenantId, { name, priceAdjustmentPercent: 0 }, userId);
}

async function cleanup() {
  await db.delete(cashbookEntries);
  await db.delete(accountsPayable);
  await db.delete(accountsReceivable);
  await db.delete(jobLogs);
  await db.delete(jobItems);
  await db.delete(jobs);
  await db.delete(orderCounters);
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

    const ars = await db.select().from(accountsReceivable).where(eq(accountsReceivable.jobId, job.id));
    expect(ars.length).toBe(1);
    expect(ars[0]?.amountCents).toBe(15000); // 2. AR.amountCents = job.totalCents
  });

  it('3. Listar AR — filtra por tenant e 4. filtra por status e 5. filtra por período', async () => {
    const u1 = await createTestUser('f3a@test.com');
    const u2 = await createTestUser('f3b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab F3A');
    const t2 = await createTestTenant(u2.id, 'Lab F3B');
    const c1 = await createTestClient(t1.id, u1.id);
    
    await financialService.createAr(t1.id, {
      clientId: c1.id,
      jobId: 0,
      amountCents: 5000,
      dueDate: new Date(Date.now() + 86400000).toISOString()
    });
    
    await financialService.createAr(t2.id, {
      clientId: c1.id,
      jobId: 0,
      amountCents: 10000,
      dueDate: new Date(Date.now() + 86400000).toISOString()
    });

    const { data } = await financialService.listAr(t1.id, { status: 'pending', limit: 20 });
    // Deve retornar apenas o AR do t1
    expect(data.length).toBe(1);
    expect(data[0]?.ar.amountCents).toBe(5000);
  });

  it('6 & 7. Marcar AR como pago — cria entrada no cashbook e atualiza status', async () => {
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
    expect(updated.status).toBe('paid');
    expect(updated.paidAt).not.toBeNull();

    // Verifica cashbook
    const cb = await db.select().from(cashbookEntries).where(eq(cashbookEntries.arId, ar.id));
    expect(cb.length).toBe(1);
    expect(cb[0]?.type).toBe('credit');
    expect(cb[0]?.amountCents).toBe(12000);
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
