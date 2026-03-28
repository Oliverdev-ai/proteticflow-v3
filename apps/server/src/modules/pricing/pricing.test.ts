import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/index.js';
import { users, tenants, tenantMembers } from '../../db/schema/index.js';
import { pricingTables, priceItems } from '../../db/schema/clients.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import * as pricingService from './service.js';

async function createTestUser(email: string) {
  const [u] = await db.insert(users).values({
    name: 'Test', email, passwordHash: await hashPassword('Test123!'), role: 'user',
  }).returning();
  if (!u) throw new Error('failed to create test user');
  return u;
}

async function createTestTenant(userId: number, name: string) {
  const { createTenant } = await import('../tenants/service.js');
  return createTenant(userId, { name });
}

async function cleanup() {
  await db.delete(priceItems);
  await db.delete(pricingTables);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('Pricing Service — Tables', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. Criar tabela — retorna com tenantId', async () => {
    const user = await createTestUser('p1@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P1');
    const table = await pricingService.createTable(tenant.id, { name: 'Tabela Base', isDefault: false });
    expect(table.tenantId).toBe(tenant.id);
    expect(table.name).toBe('Tabela Base');
  });

  it('2. Criar tabela com isDefault=true — desmarca outras', async () => {
    const user = await createTestUser('p2@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P2');
    const t1 = await pricingService.createTable(tenant.id, { name: 'T1', isDefault: true });
    await pricingService.createTable(tenant.id, { name: 'T2', isDefault: true });
    const [updated] = await db.select().from(pricingTables).where(eq(pricingTables.id, t1.id));
    expect(updated?.isDefault).toBe(false);
  });

  it('3. Rejeitar nome duplicado no mesmo tenant', async () => {
    const user = await createTestUser('p3@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P3');
    await pricingService.createTable(tenant.id, { name: 'Dup', isDefault: false });
    await expect(pricingService.createTable(tenant.id, { name: 'Dup', isDefault: false })).rejects.toThrow();
  });

  it('4. Listar tabelas — apenas do tenant autenticado', async () => {
    const u1 = await createTestUser('p4a@test.com');
    const u2 = await createTestUser('p4b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab P4A');
    const t2 = await createTestTenant(u2.id, 'Lab P4B');
    await pricingService.createTable(t1.id, { name: 'Tabela A', isDefault: false });
    await pricingService.createTable(t2.id, { name: 'Tabela B', isDefault: false });
    const { data } = await pricingService.listTables(t1.id, { page: 1, limit: 20 });
    expect(data.every(t => t.tenantId === t1.id)).toBe(true);
  });

  it('5. Soft delete tabela — não retorna na listagem', async () => {
    const user = await createTestUser('p5@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P5');
    const table = await pricingService.createTable(tenant.id, { name: 'Del Tab', isDefault: false });
    await pricingService.deleteTable(tenant.id, table.id);
    const { data } = await pricingService.listTables(tenant.id, { page: 1, limit: 20 });
    expect(data.some(t => t.id === table.id)).toBe(false);
  });
});

describe('Pricing Service — Items', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('6. Criar item — vinculado à tabela correta', async () => {
    const user = await createTestUser('p6@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P6');
    const table = await pricingService.createTable(tenant.id, { name: 'T6', isDefault: false });
    const item = await pricingService.createItem(tenant.id, { pricingTableId: table.id, name: 'Coroa', category: 'Cerâmica', priceCents: 15000, estimatedDays: 5 });
    expect(item.pricingTableId).toBe(table.id);
    expect(item.priceCents).toBe(15000);
  });

  it('7. Listar itens — filtra por tabela e tenant', async () => {
    const user = await createTestUser('p7@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P7');
    const t1 = await pricingService.createTable(tenant.id, { name: 'T7A', isDefault: false });
    const t2 = await pricingService.createTable(tenant.id, { name: 'T7B', isDefault: false });
    await pricingService.createItem(tenant.id, { pricingTableId: t1.id, name: 'Item A', category: 'Cat', priceCents: 100, estimatedDays: 3 });
    await pricingService.createItem(tenant.id, { pricingTableId: t2.id, name: 'Item B', category: 'Cat', priceCents: 200, estimatedDays: 3 });
    const { data } = await pricingService.listItems(tenant.id, { pricingTableId: t1.id, page: 1, limit: 20 });
    expect(data.every(i => i.pricingTableId === t1.id)).toBe(true);
  });

  it('8. Busca por nome/código', async () => {
    const user = await createTestUser('p8@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P8');
    const table = await pricingService.createTable(tenant.id, { name: 'T8', isDefault: false });
    await pricingService.createItem(tenant.id, { pricingTableId: table.id, name: 'Implante', category: 'Metal', priceCents: 500, estimatedDays: 7 });
    await pricingService.createItem(tenant.id, { pricingTableId: table.id, name: 'Coroa Metálica', code: 'MET-001', category: 'Metal', priceCents: 300, estimatedDays: 5 });
    const { data } = await pricingService.listItems(tenant.id, { pricingTableId: table.id, search: 'MET-001', page: 1, limit: 20 });
    expect(data).toHaveLength(1);
    expect(data[0]?.code).toBe('MET-001');
  });
});

describe('Pricing Service — Bulk Adjust', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('9. Reajuste +10% — todos os preços aumentam 10%', async () => {
    const user = await createTestUser('p9@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P9');
    const table = await pricingService.createTable(tenant.id, { name: 'T9', isDefault: false });
    await pricingService.createItem(tenant.id, { pricingTableId: table.id, name: 'I1', category: 'C', priceCents: 1000, estimatedDays: 5 });
    await pricingService.createItem(tenant.id, { pricingTableId: table.id, name: 'I2', category: 'C', priceCents: 2000, estimatedDays: 5 });
    await pricingService.bulkAdjust(tenant.id, { pricingTableId: table.id, adjustmentPercent: 10 });
    const { data } = await pricingService.listItems(tenant.id, { pricingTableId: table.id, page: 1, limit: 20 });
    expect(data.find(i => i.name === 'I1')?.priceCents).toBe(1100);
    expect(data.find(i => i.name === 'I2')?.priceCents).toBe(2200);
  });

  it('10. Reajuste -5% — todos os preços diminuem 5%', async () => {
    const user = await createTestUser('p10@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P10');
    const table = await pricingService.createTable(tenant.id, { name: 'T10', isDefault: false });
    await pricingService.createItem(tenant.id, { pricingTableId: table.id, name: 'IX', category: 'C', priceCents: 2000, estimatedDays: 5 });
    await pricingService.bulkAdjust(tenant.id, { pricingTableId: table.id, adjustmentPercent: -5 });
    const { data } = await pricingService.listItems(tenant.id, { pricingTableId: table.id, page: 1, limit: 20 });
    expect(data[0]?.priceCents).toBe(1900);
  });

  it('11. Reajuste não afeta itens inativos', async () => {
    const user = await createTestUser('p11@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P11');
    const table = await pricingService.createTable(tenant.id, { name: 'T11', isDefault: false });
    const item = await pricingService.createItem(tenant.id, { pricingTableId: table.id, name: 'Inativo', category: 'C', priceCents: 1000, estimatedDays: 5 });
    await db.update(priceItems).set({ isActive: false }).where(eq(priceItems.id, item.id));
    await pricingService.bulkAdjust(tenant.id, { pricingTableId: table.id, adjustmentPercent: 50 });
    const [raw] = await db.select().from(priceItems).where(eq(priceItems.id, item.id));
    expect(raw?.priceCents).toBe(1000); // não alterado
  });

  it('12. Reajuste atômico — retorna quantidade ajustada', async () => {
    const user = await createTestUser('p12@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P12');
    const table = await pricingService.createTable(tenant.id, { name: 'T12', isDefault: false });
    await pricingService.createItem(tenant.id, { pricingTableId: table.id, name: 'A', category: 'C', priceCents: 100, estimatedDays: 1 });
    await pricingService.createItem(tenant.id, { pricingTableId: table.id, name: 'B', category: 'C', priceCents: 200, estimatedDays: 1 });
    const { adjusted } = await pricingService.bulkAdjust(tenant.id, { pricingTableId: table.id, adjustmentPercent: 10 });
    expect(adjusted).toBe(2);
  });
});

describe('Pricing Service — CSV', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('13. Export CSV — retorna string com headers e dados corretos', async () => {
    const user = await createTestUser('p13@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P13');
    const table = await pricingService.createTable(tenant.id, { name: 'T13', isDefault: false });
    await pricingService.createItem(tenant.id, { pricingTableId: table.id, name: 'Coroa CSV', code: 'CSV-001', category: 'Cerâmica', priceCents: 5000, estimatedDays: 5 });
    const csv = await pricingService.exportCsv(tenant.id, table.id);
    expect(csv).toContain('name,code');
    expect(csv).toContain('Coroa CSV');
    expect(csv).toContain('5000');
  });

  it('14. Import CSV — cria items novos', async () => {
    const user = await createTestUser('p14@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P14');
    const table = await pricingService.createTable(tenant.id, { name: 'T14', isDefault: false });
    const csv = `name,code,description,category,material,priceCents,estimatedDays\n"Inlay","INL-001","","Metal","",3000,4`;
    const result = await pricingService.importCsv(tenant.id, table.id, csv);
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('15. Import CSV — upsert (atualiza existente por nome)', async () => {
    const user = await createTestUser('p15@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P15');
    const table = await pricingService.createTable(tenant.id, { name: 'T15', isDefault: false });
    await pricingService.createItem(tenant.id, { pricingTableId: table.id, name: 'Existing', category: 'C', priceCents: 1000, estimatedDays: 5 });
    const csv = `name,code,description,category,material,priceCents,estimatedDays\n"Existing","","","C","",2000,5`;
    const result = await pricingService.importCsv(tenant.id, table.id, csv);
    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
    const { data } = await pricingService.listItems(tenant.id, { pricingTableId: table.id, page: 1, limit: 20 });
    expect(data.find(i => i.name === 'Existing')?.priceCents).toBe(2000);
  });

  it('16. Import CSV — reporta erros por linha (preço inválido)', async () => {
    const user = await createTestUser('p16@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P16');
    const table = await pricingService.createTable(tenant.id, { name: 'T16', isDefault: false });
    const csv = `name,code,description,category,material,priceCents,estimatedDays\n"OK","","","C","",1000,5\n"Bad","","","C","",-100,5`;
    const result = await pricingService.importCsv(tenant.id, table.id, csv);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.created).toBe(1); // Só "OK" criado
  });
});

describe('Pricing Service — Tenant Isolation', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('17. User do Tenant A NÃO vê tabelas/itens do Tenant B', async () => {
    const u1 = await createTestUser('p17a@test.com');
    const u2 = await createTestUser('p17b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab P17A');
    const t2 = await createTestTenant(u2.id, 'Lab P17B');
    await pricingService.createTable(t2.id, { name: 'Secreta', isDefault: false });
    const { data } = await pricingService.listTables(t1.id, { page: 1, limit: 20 });
    expect(data.some(t => t.tenantId === t2.id)).toBe(false);
  });
});
