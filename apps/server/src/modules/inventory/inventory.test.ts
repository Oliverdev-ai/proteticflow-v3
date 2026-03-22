import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/index.js';
import { users, tenants, tenantMembers } from '../../db/schema/index.js';
import {
  materialCategories, suppliers, materials, stockMovements,
  purchaseOrders, purchaseOrderItems,
} from '../../db/schema/materials.js';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import * as inventoryService from './service.js';

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
  await db.delete(purchaseOrderItems);
  await db.delete(purchaseOrders);
  await db.delete(stockMovements);
  await db.delete(materials);
  await db.delete(materialCategories);
  await db.delete(suppliers);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('Inventory Service — Categorias e Fornecedores', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. CRUD categoria — cria, lista e soft-delete', async () => {
    const user = await createTestUser('inv1@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv1');

    const cat = await inventoryService.createCategory(tenant.id, { name: 'Resinas', color: 'blue' });
    expect(cat.name).toBe('Resinas');
    expect(cat.tenantId).toBe(tenant.id);

    const cats = await inventoryService.listCategories(tenant.id);
    expect(cats.length).toBe(1);

    await inventoryService.deleteCategory(tenant.id, cat.id);
    const catsAfter = await inventoryService.listCategories(tenant.id);
    expect(catsAfter.length).toBe(0); // soft-delete invisível
  });

  it('2. CRUD fornecedor com CNPJ', async () => {
    const user = await createTestUser('inv2@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv2');

    const sup = await inventoryService.createSupplier(tenant.id, {
      name: 'Dental Plus LTDA',
      cnpj: '12.345.678/0001-90',
      email: 'contato@dentalplus.com',
    });
    expect(sup.name).toBe('Dental Plus LTDA');
    expect(sup.cnpj).toBe('12.345.678/0001-90');
    expect(sup.tenantId).toBe(tenant.id);
  });

  it('3. Toggle fornecedor ativo/inativo', async () => {
    const user = await createTestUser('inv3@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv3');

    const sup = await inventoryService.createSupplier(tenant.id, { name: 'Fornecedor X' });
    expect(sup.isActive).toBe(true);

    const inativo = await inventoryService.toggleSupplierActive(tenant.id, sup.id);
    expect(inativo.isActive).toBe(false);

    const ativo = await inventoryService.toggleSupplierActive(tenant.id, sup.id);
    expect(ativo.isActive).toBe(true);
  });
});

describe('Inventory Service — Materiais', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('4. Criar material com todos os campos', async () => {
    const user = await createTestUser('inv4@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv4');

    const mat = await inventoryService.createMaterial(tenant.id, {
      name: 'Resina A3',
      code: 'RES-A3',
      barcode: '7891234567890',
      description: 'Resina composta A3',
      unit: 'ml',
      minStock: 100,
    }, user.id);
    expect(mat.name).toBe('Resina A3');
    expect(mat.code).toBe('RES-A3');
    expect(mat.barcode).toBe('7891234567890');
    expect(mat.tenantId).toBe(tenant.id);
  });

  it('5. Listar com busca ILIKE (nome, code, barcode)', async () => {
    const user = await createTestUser('inv5@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv5');

    await inventoryService.createMaterial(tenant.id, { name: 'Resina A2', code: 'RES-A2', unit: 'ml', minStock: 0 }, user.id);
    await inventoryService.createMaterial(tenant.id, { name: 'Cera Rosa', barcode: '7891234', unit: 'kg', minStock: 0 }, user.id);
    await inventoryService.createMaterial(tenant.id, { name: 'Gesso IV', unit: 'kg', minStock: 0 }, user.id);

    const byName = await inventoryService.listMaterials(tenant.id, { search: 'resina', page: 1, limit: 20 });
    expect(byName.total).toBe(1);
    expect(byName.data[0]?.name).toBe('Resina A2');

    const byCode = await inventoryService.listMaterials(tenant.id, { search: 'RES-A2', page: 1, limit: 20 });
    expect(byCode.total).toBe(1);

    const byBarcode = await inventoryService.listMaterials(tenant.id, { search: '7891234', page: 1, limit: 20 });
    expect(byBarcode.total).toBe(1);
  });

  it('6. Listar filtrando belowMinimum (09.06)', async () => {
    const user = await createTestUser('inv6@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv6');

    const m1 = await inventoryService.createMaterial(tenant.id, { name: 'Material Alto', unit: 'un', minStock: 5 }, user.id);
    await inventoryService.createMaterial(tenant.id, { name: 'Material Baixo', unit: 'un', minStock: 10 }, user.id);

    // Dar entrada no m1 para termos estoque > mínimo
    await inventoryService.createMovement(tenant.id, { materialId: m1.id, type: 'in', quantity: 20, unitCostCents: 1000 }, user.id);

    const abaixo = await inventoryService.listMaterials(tenant.id, { belowMinimum: true, page: 1, limit: 20 });
    expect(abaixo.total).toBe(1); // só Material Baixo (estoque 0 < minStock 10)
    expect(abaixo.data[0]?.name).toBe('Material Baixo');
  });
});

describe('Inventory Service — Movimentações (AP-13)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('7. Entrada — incrementa estoque atomicamente', async () => {
    const user = await createTestUser('inv7@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv7');
    const mat = await inventoryService.createMaterial(tenant.id, { name: 'Gesso', unit: 'kg', minStock: 0 }, user.id);

    await inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'in', quantity: 50, unitCostCents: 2000 }, user.id);
    const updated = await inventoryService.getMaterial(tenant.id, mat.id);
    expect(Number(updated.currentStock)).toBe(50);
  });

  it('8. Entrada — recalcula custo médio ponderado (09.05)', async () => {
    const user = await createTestUser('inv8@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv8');
    const mat = await inventoryService.createMaterial(tenant.id, { name: 'Gesso VIII', unit: 'kg', minStock: 0 }, user.id);

    // 1ª entrada: 10 un a R$100/un → avg = 10000
    await inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'in', quantity: 10, unitCostCents: 10000 }, user.id);
    // 2ª entrada: 10 un a R$200/un → avg = (10*10000 + 10*20000) / 20 = 15000
    await inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'in', quantity: 10, unitCostCents: 20000 }, user.id);

    const updated = await inventoryService.getMaterial(tenant.id, mat.id);
    expect(Number(updated.currentStock)).toBe(20);
    expect(updated.averageCostCents).toBe(15000);
    expect(updated.lastPurchasePriceCents).toBe(20000);
  });

  it('9. Saída — decrementa estoque atomicamente', async () => {
    const user = await createTestUser('inv9@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv9');
    const mat = await inventoryService.createMaterial(tenant.id, { name: 'Resina IX', unit: 'ml', minStock: 0 }, user.id);

    await inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'in', quantity: 100, unitCostCents: 500 }, user.id);
    const mv = await inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'out', quantity: 30 }, user.id);

    expect(Number(mv.stockAfter)).toBe(70);
    const updated = await inventoryService.getMaterial(tenant.id, mat.id);
    expect(Number(updated.currentStock)).toBe(70);
  });

  it('10. Saída — REJEITA se estoque insuficiente (AP-13)', async () => {
    const user = await createTestUser('inv10@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv10');
    const mat = await inventoryService.createMaterial(tenant.id, { name: 'Resina X', unit: 'ml', minStock: 0 }, user.id);

    await inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'in', quantity: 5, unitCostCents: 500 }, user.id);

    await expect(
      inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'out', quantity: 10 }, user.id)
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const mat2 = await inventoryService.getMaterial(tenant.id, mat.id);
    expect(Number(mat2.currentStock)).toBe(5); // intacto
  });

  it('11. Ajuste — seta valor absoluto', async () => {
    const user = await createTestUser('inv11@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv11');
    const mat = await inventoryService.createMaterial(tenant.id, { name: 'Gesso XI', unit: 'kg', minStock: 0 }, user.id);

    await inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'in', quantity: 50, unitCostCents: 100 }, user.id);
    await inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'adjustment', quantity: 30 }, user.id);

    const updated = await inventoryService.getMaterial(tenant.id, mat.id);
    expect(Number(updated.currentStock)).toBe(30);
  });

  it('12. stockAfter registrado corretamente na movimentação', async () => {
    const user = await createTestUser('inv12@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv12');
    const mat = await inventoryService.createMaterial(tenant.id, { name: 'Mat XII', unit: 'un', minStock: 0 }, user.id);

    await inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'in', quantity: 100, unitCostCents: 100 }, user.id);
    const mv = await inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'out', quantity: 40 }, user.id);

    expect(Number(mv.stockAfter)).toBe(60);
  });

  it('13. Consumo por OS — type=out com jobId vinculado (09.10)', async () => {
    const user = await createTestUser('inv13@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv13');
    const mat = await inventoryService.createMaterial(tenant.id, { name: 'Mat XIII', unit: 'un', minStock: 0 }, user.id);

    await inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'in', quantity: 50, unitCostCents: 100 }, user.id);
    const mv = await inventoryService.consumeForJob(tenant.id, mat.id, 5, 999, user.id);

    expect(mv.type).toBe('out');
    expect(mv.jobId).toBe(999);
    expect(Number(mv.quantity)).toBe(5);
    expect(Number(mv.stockAfter)).toBe(45);
  });

  it('14. Duas saídas simultâneas — estoque NÃO fica negativo (AP-13 race condition)', async () => {
    const user = await createTestUser('inv14@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv14');
    const mat = await inventoryService.createMaterial(tenant.id, { name: 'Mat XIV', unit: 'un', minStock: 0 }, user.id);

    await inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'in', quantity: 8, unitCostCents: 100 }, user.id);

    // Race condition: dois requests simultâneos de saída para 5 cada, mas só 8 disponível
    const results = await Promise.allSettled([
      inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'out', quantity: 5 }, user.id),
      inventoryService.createMovement(tenant.id, { materialId: mat.id, type: 'out', quantity: 5 }, user.id),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Exatamente 1 deve suceder e 1 deve falhar (não ambos)
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const finalMat = await inventoryService.getMaterial(tenant.id, mat.id);
    expect(Number(finalMat.currentStock)).toBe(3); // 8 - 5 = 3, não negativo
  });
});
