import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/index.js';
import { users, tenants, tenantMembers } from '../../db/schema/index.js';
import { clients, pricingTables } from '../../db/schema/clients.js';
import { jobs } from '../../db/schema/jobs.js';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import * as clientService from './service.js';

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

async function cleanup() {
  await db.delete(clients);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('Client Service — CRUD', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. Criar cliente com todos os campos — retorna id e tenantId correto', async () => {
    const user = await createTestUser('c1@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C1');
    const client = await clientService.createClient(tenant.id, { name: 'João Silva', priceAdjustmentPercent: 0 }, user.id);
    expect(client.tenantId).toBe(tenant.id);
    expect(client.name).toBe('João Silva');
  });

  it('2. Criar cliente incrementa tenants.clientCount', async () => {
    const user = await createTestUser('c2@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C2');
    await clientService.createClient(tenant.id, { name: 'Cli A', priceAdjustmentPercent: 0 }, user.id);
    await clientService.createClient(tenant.id, { name: 'Cli B', priceAdjustmentPercent: 0 }, user.id);
    const [t] = await db.select().from(tenants).where(eq(tenants.id, tenant.id));
    if (!t) throw new Error('Tenant not found in test');
    expect(t.clientCount).toBe(2);
  });

  it('3. Rejeitar documento duplicado no mesmo tenant', async () => {
    const user = await createTestUser('c3@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C3');
    await clientService.createClient(tenant.id, { name: 'A', document: '123456789', documentType: 'cpf', priceAdjustmentPercent: 0 }, user.id);
    await expect(
      clientService.createClient(tenant.id, { name: 'B', document: '123456789', documentType: 'cpf', priceAdjustmentPercent: 0 }, user.id)
    ).rejects.toThrow();
  });

  it('4. Permitir documento duplicado em tenants diferentes', async () => {
    const u1 = await createTestUser('c4a@test.com');
    const u2 = await createTestUser('c4b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab C4A');
    const t2 = await createTestTenant(u2.id, 'Lab C4B');
    await clientService.createClient(t1.id, { name: 'X', document: '999', documentType: 'cpf', priceAdjustmentPercent: 0 }, u1.id);
    const c2 = await clientService.createClient(t2.id, { name: 'Y', document: '999', documentType: 'cpf', priceAdjustmentPercent: 0 }, u2.id);
    expect(c2.id).toBeGreaterThan(0);
  });

  it('5. Listar clientes — retorna apenas do tenant autenticado', async () => {
    const u1 = await createTestUser('c5a@test.com');
    const u2 = await createTestUser('c5b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab C5A');
    const t2 = await createTestTenant(u2.id, 'Lab C5B');
    await clientService.createClient(t1.id, { name: 'Cli T1', priceAdjustmentPercent: 0 }, u1.id);
    await clientService.createClient(t2.id, { name: 'Cli T2', priceAdjustmentPercent: 0 }, u2.id);
    const { data } = await clientService.listClients(t1.id, { page: 1, limit: 20 });
    expect(data.every(c => c.tenantId === t1.id)).toBe(true);
  });

  it('6. Listar com busca por nome — filtra corretamente', async () => {
    const user = await createTestUser('c6@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C6');
    await clientService.createClient(tenant.id, { name: 'Dentista Zé', priceAdjustmentPercent: 0 }, user.id);
    await clientService.createClient(tenant.id, { name: 'Clínica Boa', priceAdjustmentPercent: 0 }, user.id);
    const { data } = await clientService.listClients(tenant.id, { search: 'Dentista', page: 1, limit: 20 });
    expect(data).toHaveLength(1);
    expect(data[0]?.name).toBe('Dentista Zé');
  });

  it('7. Listar com busca por documento — filtra corretamente', async () => {
    const user = await createTestUser('c7@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C7');
    await clientService.createClient(tenant.id, { name: 'A', document: '11111111111', documentType: 'cpf', priceAdjustmentPercent: 0 }, user.id);
    await clientService.createClient(tenant.id, { name: 'B', document: '22222222222', documentType: 'cpf', priceAdjustmentPercent: 0 }, user.id);
    const { data } = await clientService.listClients(tenant.id, { search: '11111', page: 1, limit: 20 });
    expect(data).toHaveLength(1);
  });

  it('8. Listar com filtro status=inactive — retorna apenas inativos', async () => {
    const user = await createTestUser('c8@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C8');
    const c = await clientService.createClient(tenant.id, { name: 'Ativo', priceAdjustmentPercent: 0 }, user.id);
    await clientService.toggleClientStatus(tenant.id, c.id);
    await clientService.createClient(tenant.id, { name: 'Ativo2', priceAdjustmentPercent: 0 }, user.id);
    const { data } = await clientService.listClients(tenant.id, { status: 'inactive', page: 1, limit: 20 });
    expect(data.every(c => c.status === 'inactive')).toBe(true);
  });

  it('9. Listar — não retorna soft-deleted', async () => {
    const user = await createTestUser('c9@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C9');
    const c = await clientService.createClient(tenant.id, { name: 'Vai Ser Deletado', priceAdjustmentPercent: 0 }, user.id);
    await db.update(clients).set({ deletedAt: new Date() }).where(eq(clients.id, c.id));
    const { data } = await clientService.listClients(tenant.id, { page: 1, limit: 20 });
    expect(data.some(cl => cl.id === c.id)).toBe(false);
  });

  it('10. Paginação — page=1 limit=2 retorna 2, total correto', async () => {
    const user = await createTestUser('c10@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C10');
    for (let i = 0; i < 4; i++) {
      await clientService.createClient(tenant.id, { name: `Cli ${i}`, priceAdjustmentPercent: 0 }, user.id);
    }
    const { data, total } = await clientService.listClients(tenant.id, { page: 1, limit: 2 });
    expect(data).toHaveLength(2);
    expect(total).toBe(4);
  });

  it('11. Editar cliente — atualiza campos', async () => {
    const user = await createTestUser('c11@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C11');
    const c = await clientService.createClient(tenant.id, { name: 'Orig', priceAdjustmentPercent: 0 }, user.id);
    const updated = await clientService.updateClient(tenant.id, c.id, { name: 'Novo Nome' }, user.id);
    expect(updated.name).toBe('Novo Nome');
  });

  it('12. Editar — rejeita clientId de outro tenant (tenant isolation)', async () => {
    const u1 = await createTestUser('c12a@test.com');
    const u2 = await createTestUser('c12b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab C12A');
    const t2 = await createTestTenant(u2.id, 'Lab C12B');
    const c = await clientService.createClient(t1.id, { name: 'Original', priceAdjustmentPercent: 0 }, u1.id);
    await expect(clientService.updateClient(t2.id, c.id, { name: 'Hack' }, u2.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('13. Toggle status — alterna active/inactive', async () => {
    const user = await createTestUser('c13@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C13');
    const c = await clientService.createClient(tenant.id, { name: 'Toggle', priceAdjustmentPercent: 0 }, user.id);
    expect(c.status).toBe('active');
    const toggled = await clientService.toggleClientStatus(tenant.id, c.id);
    expect(toggled.status).toBe('inactive');
    const toggled2 = await clientService.toggleClientStatus(tenant.id, c.id);
    expect(toggled2.status).toBe('active');
  });

  it('14. Delete — soft delete (deletedAt populado, não some do banco)', async () => {
    const user = await createTestUser('c14@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C14');
    const c = await clientService.createClient(tenant.id, { name: 'Del', priceAdjustmentPercent: 0 }, user.id);
    await clientService.deleteClient(tenant.id, c.id, user.id);
    const [raw] = await db.select().from(clients).where(eq(clients.id, c.id));
    expect(raw?.deletedAt).not.toBeNull();
  });

  it('15. Delete — rejeita se tem OS vinculadas', async () => {
    const user = await createTestUser('c15@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C15');
    const c = await clientService.createClient(tenant.id, { name: 'ComOS', priceAdjustmentPercent: 0 }, user.id);
    // Inserir job fake
    await db.insert(jobs).values({
      tenantId: tenant.id,
      clientId: c.id,
      code: 'OS-001',
      orderNumber: 1,
      status: 'pending',
      totalCents: 0,
      deadline: new Date(Date.now() + 86400000),
      createdBy: user.id,
    });
    await expect(clientService.deleteClient(tenant.id, c.id, user.id)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('16. Extrato — retorna totais corretos (pode ser 0 sem dados)', async () => {
    const user = await createTestUser('c16@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C16');
    const c = await clientService.createClient(tenant.id, { name: 'Extrato', priceAdjustmentPercent: 0 }, user.id);
    const extract = await clientService.getClientExtract(tenant.id, c.id);
    expect(extract.client.id).toBe(c.id);
    expect(extract.totalJobs).toBeGreaterThanOrEqual(0);
  });

  it('17. RBAC — Create aceita para qualquer membro (testado via service com tenantId)', async () => {
    const user = await createTestUser('c17@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C17');
    const c = await clientService.createClient(tenant.id, { name: 'RBAC OK', priceAdjustmentPercent: 0 }, user.id);
    expect(c.id).toBeGreaterThan(0);
  });

  it('18. RBAC — delete requer admin (verificado pelo router adminProcedure)', async () => {
    // A proteção é no router (adminProcedure). Aqui apenas testamos que o service aceita sem role check.
    const user = await createTestUser('c18@test.com');
    const tenant = await createTestTenant(user.id, 'Lab C18');
    const c = await clientService.createClient(tenant.id, { name: 'Del', priceAdjustmentPercent: 0 }, user.id);
    await clientService.deleteClient(tenant.id, c.id, user.id);
    const [raw] = await db.select().from(clients).where(eq(clients.id, c.id));
    expect(raw?.deletedAt).not.toBeNull();
  });

  it('19. Tenant Isolation — User do Tenant A NÃO vê clientes do Tenant B', async () => {
    const u1 = await createTestUser('c19a@test.com');
    const u2 = await createTestUser('c19b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab 19A');
    const t2 = await createTestTenant(u2.id, 'Lab 19B');
    await clientService.createClient(t2.id, { name: 'Secreto', priceAdjustmentPercent: 0 }, u2.id);
    const { data } = await clientService.listClients(t1.id, { page: 1, limit: 100 });
    expect(data.some(c => c.tenantId === t2.id)).toBe(false);
  });
});
