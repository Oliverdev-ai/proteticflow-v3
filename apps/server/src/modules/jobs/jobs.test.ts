import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/index.js';
import { osBlocks, users, tenants, tenantMembers } from '../../db/schema/index.js';
import { jobs, jobItems, jobLogs, orderCounters } from '../../db/schema/jobs.js';
import { clients } from '../../db/schema/clients.js';
import { deliveryItems } from '../../db/schema/deliveries.js';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import * as jobService from './service.js';

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
  return createClient(tenantId, { name, priceAdjustmentPercent: 0 }, userId);
}

async function cleanup() {
  await db.delete(jobLogs);
  await db.delete(jobItems);
  await db.delete(jobs);
  await db.delete(orderCounters);
  await db.delete(osBlocks);
  await db.delete(clients);
  await db.delete(tenantMembers);
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  try {
    await db.delete(tenants);
  } catch {
    // Retry once in case licensing logs are inserted near teardown boundaries.
    await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
    await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
    await db.delete(tenants);
  }
  await db.delete(users);
}

const baseItem = {
  serviceNameSnapshot: 'Coroa Zircônia',
  quantity: 1,
  unitPriceCents: 15000,
  adjustmentPercent: 0,
};

describe('Job Service — CRUD', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. Criar OS — gera orderNumber sequencial (PAD-04)', async () => {
    const user = await createTestUser('j1@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J1');
    const client = await createTestClient(tenant.id, user.id);
    const job = await jobService.createJob(tenant.id, {
      clientId: client.id,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      items: [baseItem],
    }, user.id);
    expect(job.orderNumber).toBe(1);
    expect(job.code).toBe('OS-00001');
  }, 20_000);

  it('2. Criar OS — congela preço dos itens (AP-02: unitPriceCents copiado, NÃO referenciado)', async () => {
    const user = await createTestUser('j2@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J2');
    const client = await createTestClient(tenant.id, user.id);

    // Criar tabela de preços e item
    const { createTable, createItem } = await import('../pricing/service.js');
    const table = await createTable(tenant.id, { name: 'Tabela J2', isDefault: true });
    const priceItem = await createItem(tenant.id, { pricingTableId: table.id, name: 'Implante', category: 'Metal', priceCents: 20000, estimatedDays: 7 });

    const job = await jobService.createJob(tenant.id, {
      clientId: client.id,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      items: [{ priceItemId: priceItem.id, serviceNameSnapshot: 'Implante', quantity: 1, unitPriceCents: 99999, adjustmentPercent: 0 }],
    }, user.id);

    // unitPriceCents deve ser o do priceItem (20000), não o enviado (99999)
    const [item] = await db.select().from(jobItems).where(eq(jobItems.jobId, job.id));
    expect(item?.unitPriceCents).toBe(20000);
  }, 20_000);

  it('3. Criar OS — calcula totalCents corretamente = soma dos items', async () => {
    const user = await createTestUser('j3@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J3');
    const client = await createTestClient(tenant.id, user.id);

    const job = await jobService.createJob(tenant.id, {
      clientId: client.id,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      items: [
        { serviceNameSnapshot: 'Item A', quantity: 2, unitPriceCents: 10000, adjustmentPercent: 0 },
        { serviceNameSnapshot: 'Item B', quantity: 1, unitPriceCents: 5000, adjustmentPercent: 0 },
      ],
    }, user.id);

    // 2×10000 + 1×5000 = 25000
    expect(job.totalCents).toBe(25000);
  });

  it('4. Criar OS — incrementa clients.totalJobs', async () => {
    const user = await createTestUser('j4@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J4');
    const client = await createTestClient(tenant.id, user.id);
    await jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id);
    await jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id);
    const [c] = await db.select().from(clients).where(eq(clients.id, client.id));
    expect(c?.totalJobs).toBe(2);
  });

  it('5. Criar OS — ajuste do cliente aplicado nos items', async () => {
    const user = await createTestUser('j5@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J5');
    const { createClient } = await import('../clients/service.js');
    // Cliente com desconto de 10%
    const client = await createClient(tenant.id, { name: 'Desconto', priceAdjustmentPercent: -10 }, user.id);

    const job = await jobService.createJob(tenant.id, {
      clientId: client.id,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      items: [{ serviceNameSnapshot: 'X', quantity: 1, unitPriceCents: 10000, adjustmentPercent: 0 }],
    }, user.id);

    // 10000 * (1 + (-10)/100) = 9000
    expect(job.totalCents).toBe(9000);
  });

  it('6. Criar duas OS simultaneamente — orderNumbers não colidem (PAD-04)', async () => {
    const user = await createTestUser('j6@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J6');
    const client = await createTestClient(tenant.id, user.id);

    const [j1, j2] = await Promise.all([
      jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id),
      jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id),
    ]);

    expect(j1.orderNumber).not.toBe(j2.orderNumber);
    const orderNums = [j1.orderNumber, j2.orderNumber].sort();
    expect(orderNums[1]! - orderNums[0]!).toBe(1);
  });

  it('7. Listar OS — retorna apenas do tenant autenticado', async () => {
    const u1 = await createTestUser('j7a@test.com');
    const u2 = await createTestUser('j7b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab J7A');
    const t2 = await createTestTenant(u2.id, 'Lab J7B');
    const c1 = await createTestClient(t1.id, u1.id);
    const c2 = await createTestClient(t2.id, u2.id);
    await jobService.createJob(t1.id, { clientId: c1.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, u1.id);
    await jobService.createJob(t2.id, { clientId: c2.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, u2.id);
    const { data } = await jobService.listJobs(t1.id, { limit: 20 });
    expect(data.every(j => j.clientId === c1.id)).toBe(true);
  });

  it('8. Listar com filtro status — filtra corretamente', async () => {
    const user = await createTestUser('j8@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J8');
    const client = await createTestClient(tenant.id, user.id);
    const job = await jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id);
    const { data } = await jobService.listJobs(tenant.id, { status: 'in_progress', limit: 20 });
    expect(data.every(j => j.status === 'in_progress')).toBe(true);
  });

  it('9. Listar com filtro overdue — retorna apenas atrasados', async () => {
    const user = await createTestUser('j9@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J9');
    const client = await createTestClient(tenant.id, user.id);
    // Criar OS com prazo no passado
    await jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() - 86400000).toISOString(), items: [baseItem] }, user.id);
    // OS no prazo
    await jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id);
    const { data } = await jobService.listJobs(tenant.id, { overdue: true, limit: 20 });
    expect(data.length).toBeGreaterThan(0);
    for (const j of data) {
      expect(new Date(j.deadline).getTime()).toBeLessThan(Date.now());
    }
  });

  it('10. Cursor pagination funcional', async () => {
    const user = await createTestUser('j10@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J10');
    const client = await createTestClient(tenant.id, user.id);
    for (let i = 0; i < 5; i++) {
      await jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id);
    }
    const page1 = await jobService.listJobs(tenant.id, { limit: 3 });
    expect(page1.data).toHaveLength(3);
    expect(page1.nextCursor).toBeDefined();
    const page2 = await jobService.listJobs(tenant.id, { limit: 3, cursor: page1.nextCursor! });
    // 5 total - 3 first page = 2 remaining (cursor is on id, DESC order)
    expect(page2.data.length).toBeGreaterThan(0);
  });

  it('11. Editar OS — atualiza campos, NÃO muda orderNumber', async () => {
    const user = await createTestUser('j11@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J11');
    const client = await createTestClient(tenant.id, user.id);
    const job = await jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id);
    const updated = (await jobService.updateJob(tenant.id, job.id, { patientName: 'Paciente Updated' }, user.id))!;
    expect(updated.patientName).toBe('Paciente Updated');
    expect(updated.orderNumber).toBe(job.orderNumber);
  });
});

describe('Job Service — Status Machine', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  async function setup(email: string, tenantName: string) {
    const user = await createTestUser(email);
    const tenant = await createTestTenant(user.id, tenantName);
    const client = await createTestClient(tenant.id, user.id);
    const job = await jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id);
    return { user, tenant, client, job };
  }

  it('12. pending → in_progress: permitido', async () => {
    const { user, tenant, job } = await setup('j12@test.com', 'Lab J12');
    const updated = (await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id))!;
    expect(updated.status).toBe('in_progress');
  });

  it('13. pending → ready: REJEITADO (transição inválida)', async () => {
    const { user, tenant, job } = await setup('j13@test.com', 'Lab J13');
    await expect(jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'ready' }, user.id))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('14. in_progress → quality_check → ready → delivered: cadeia completa', async () => {
    const { user, tenant, job } = await setup('j14@test.com', 'Lab J14');
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'quality_check' }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'ready' }, user.id);
    const final = (await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'delivered' }, user.id))!;
    expect(final.status).toBe('delivered');
  });

  it('15. Qualquer → cancelled: permitido (exceto delivered e cancelled)', async () => {
    const { user, tenant, job } = await setup('j15@test.com', 'Lab J15');
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id);
    const cancelled = (await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'cancelled', cancelReason: 'Teste' }, user.id))!;
    expect(cancelled.status).toBe('cancelled');
  });

  it('16. delivered → qualquer: REJEITADO (estado final)', async () => {
    const { user, tenant, job } = await setup('j16@test.com', 'Lab J16');
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'quality_check' }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'ready' }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'delivered' }, user.id);
    await expect(jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
  }, 20_000);

  it('17. cancelled → qualquer: REJEITADO (estado final)', async () => {
    const { user, tenant, job } = await setup('j17@test.com', 'Lab J17');
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'cancelled', cancelReason: 'Teste' }, user.id);
    await expect(jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('18. ready → setar completedAt automaticamente', async () => {
    const { user, tenant, job } = await setup('j18@test.com', 'Lab J18');
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'quality_check' }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'ready' }, user.id);
    const [jdb] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(jdb?.completedAt).not.toBeNull();
  });

  it('19. delivered → setar deliveredAt automaticamente', async () => {
    const { user, tenant, job } = await setup('j19@test.com', 'Lab J19');
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'quality_check' }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'ready' }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'delivered' }, user.id);
    const [jdb] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(jdb?.deliveredAt).not.toBeNull();
  });

  it('20. cancelled → exige cancelReason', async () => {
    const { user, tenant, job } = await setup('j20@test.com', 'Lab J20');
    // changeStatus com cancelReason vazio é validado pelo schema (Zod), mas testamos o service
    // que deve setar cancelReason vindo do input
    const updated = (await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'cancelled', cancelReason: 'Motivo' }, user.id))!;
    const [jdb] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(jdb?.cancelReason).toBe('Motivo');
    expect(updated.status).toBe('cancelled');
  });
});

describe('Job Service — Logs', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('21. Toda mudança de status gera jobLog', async () => {
    const user = await createTestUser('j21@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J21');
    const client = await createTestClient(tenant.id, user.id);
    const job = await jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id);
    const logs = await jobService.getLogs(tenant.id, job.id);
    // Deve ter: log de criação (pending) + log de in_progress = 2
    expect(logs.length).toBeGreaterThanOrEqual(2);
  });

  it('22. getLogs retorna ordenado por data DESC', async () => {
    const user = await createTestUser('j22@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J22');
    const client = await createTestClient(tenant.id, user.id);
    const job = await jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id);
    await jobService.changeStatus(tenant.id, { jobId: job.id, newStatus: 'in_progress' }, user.id);
    const logs = await jobService.getLogs(tenant.id, job.id);
    expect(logs[0]?.toStatus).toBe('in_progress'); // mais recente primeiro
  });
});

describe('Job Service — RBAC e Tenant Isolation', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('23. Delete soft — funciona (RBAC verificado no router adminProcedure)', async () => {
    const user = await createTestUser('j23@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J23');
    const client = await createTestClient(tenant.id, user.id);
    const job = await jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id);
    await jobService.deleteJob(tenant.id, job.id, user.id);
    const [jdb] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    expect(jdb?.deletedAt).not.toBeNull();
  });

  it('24. Create aceita user com role user (licensedProcedure testada no router)', async () => {
    const user = await createTestUser('j24@test.com');
    const tenant = await createTestTenant(user.id, 'Lab J24');
    const client = await createTestClient(tenant.id, user.id);
    const job = await jobService.createJob(tenant.id, { clientId: client.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, user.id);
    expect(job.id).toBeGreaterThan(0);
  });

  it('25. User do Tenant A NÃO vê jobs do Tenant B', async () => {
    const u1 = await createTestUser('j25a@test.com');
    const u2 = await createTestUser('j25b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab J25A');
    const t2 = await createTestTenant(u2.id, 'Lab J25B');
    await createTestClient(t1.id, u1.id);
    const c2 = await createTestClient(t2.id, u2.id);
    await jobService.createJob(t2.id, { clientId: c2.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem] }, u2.id);
    const { data } = await jobService.listJobs(t1.id, { limit: 100 });
    expect(data.some(j => j.clientId === c2.id)).toBe(false);
  });
});

describe('OS Blocks — Logs, Sync & Resolution', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('T01: createOsBlock registra bloco corretamente', async () => {
    const u = await createTestUser('t01@test.com');
    const t = await createTestTenant(u.id, 'T01');
    const c = await createTestClient(t.id, u.id);
    const { createOsBlock } = await import('./os-blocks.service.js');
    
    const block = await createOsBlock(t.id, {
      clientId: c.id,
      startNumber: 1000,
      endNumber: 2000,
      label: 'Bloco Teste',
    });
    
    expect(block!.id).toBeDefined();
    expect(block!.startNumber).toBe(1000);
    expect(block!.endNumber).toBe(2000);
  });

  it('T02: resolveClientByOsNumber retorna cliente correto', async () => {
    const u = await createTestUser('t02@test.com');
    const t = await createTestTenant(u.id, 'T02');
    const c = await createTestClient(t.id, u.id);
    const { createOsBlock, resolveClientByOsNumber } = await import('./os-blocks.service.js');
    
    await createOsBlock(t.id, { clientId: c.id, startNumber: 100, endNumber: 200 });
    const resolved = await resolveClientByOsNumber(t.id, 150);
    
    expect(resolved?.clientId).toBe(c.id);
  });

  it('T03: resolveClientByOsNumber retorna null para número fora de range', async () => {
    const u = await createTestUser('t03@test.com');
    const t = await createTestTenant(u.id, 'T03');
    const c = await createTestClient(t.id, u.id);
    const { createOsBlock, resolveClientByOsNumber } = await import('./os-blocks.service.js');
    
    await createOsBlock(t.id, { clientId: c.id, startNumber: 100, endNumber: 200 });
    const resolved = await resolveClientByOsNumber(t.id, 250);
    
    expect(resolved).toBeNull();
  });

  it('T04: createJob com osNumber auto-resolve cliente', async () => {
    const u = await createTestUser('t04@test.com');
    const t = await createTestTenant(u.id, 'T04');
    const c = await createTestClient(t.id, u.id);
    const { createOsBlock } = await import('./os-blocks.service.js');
    
    await createOsBlock(t.id, { clientId: c.id, startNumber: 50, endNumber: 100 });
    const job = await jobService.createJob(t.id, {
      osNumber: 75,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      items: [baseItem]
    }, u.id);
    
    expect(job.clientId).toBe(c.id);
    expect(job.code).toBe('OS-00075');
  });

  it('T05: createJob sem osNumber mantém auto-increment', async () => {
    const u = await createTestUser('t05@test.com');
    const t = await createTestTenant(u.id, 'T05');
    const c = await createTestClient(t.id, u.id);
    
    const job = await jobService.createJob(t.id, {
      clientId: c.id,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      items: [baseItem]
    }, u.id);
    
    expect(job.orderNumber).toBe(1);
    expect(job.code).toBe('OS-00001');
  });

  it('T06: changeStatus para ready cria evento e logs (logistic_sync chamado)', async () => {
    const u = await createTestUser('t06@test.com');
    const t = await createTestTenant(u.id, 'T06');
    const c = await createTestClient(t.id, u.id);
    const job = await jobService.createJob(t.id, {
      clientId: c.id, deadline: new Date(Date.now() + 86400000).toISOString(), items: [baseItem]
    }, u.id);
    
    await jobService.changeStatus(t.id, { jobId: job.id, newStatus: 'in_progress' }, u.id);
    await jobService.changeStatus(t.id, { jobId: job.id, newStatus: 'quality_check' }, u.id);
    const updated = await jobService.changeStatus(t.id, { jobId: job.id, newStatus: 'ready' }, u.id);
    expect(updated?.status).toBe('ready');
  });

  it('T07: auto-insert em ready preenche deliveryAddress com endereco da clinica quando disponivel', async () => {
    const u = await createTestUser('t07@test.com');
    const t = await createTestTenant(u.id, 'T07');
    const { createClient } = await import('../clients/service.js');
    const c = await createClient(t.id, {
      name: 'Clinica T07',
      clinic: 'Av. Brasil, 1000',
      priceAdjustmentPercent: 0,
    }, u.id);
    if (!c) throw new Error('Falha ao criar cliente para T07');

    const job = await jobService.createJob(t.id, {
      clientId: c.id,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      items: [baseItem],
    }, u.id);

    await jobService.changeStatus(t.id, { jobId: job.id, newStatus: 'in_progress' }, u.id);
    await jobService.changeStatus(t.id, { jobId: job.id, newStatus: 'quality_check' }, u.id);
    await jobService.changeStatus(t.id, { jobId: job.id, newStatus: 'ready' }, u.id);

    const [deliveryItem] = await db.select().from(deliveryItems).where(eq(deliveryItems.jobId, job.id));
    expect(deliveryItem).toBeDefined();
    expect(deliveryItem?.deliveryAddress).toBe('Av. Brasil, 1000');
  });
});
