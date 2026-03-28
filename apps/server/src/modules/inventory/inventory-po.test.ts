import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/index.js';
import { users, tenants, tenantMembers } from '../../db/schema/index.js';
import {
  materialCategories, suppliers, materials, stockMovements,
  purchaseOrders, purchaseOrderItems,
} from '../../db/schema/materials.js';
import { hashPassword } from '../../core/auth.js';
import * as inventoryService from '../inventory/service.js';

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

// ─── Helper NF-e XML mínimo ───────────────────────────────────────────────────
function makeNfeXml(supplierCnpj: string, supplierName: string, items: Array<{ name: string; qty: number; price: number }>) {
  const dets = items.map((i, idx) => `<det nItem="${idx + 1}"><prod><xProd>${i.name}</xProd><qCom>${i.qty}</qCom><vUnCom>${i.price}</vUnCom></prod></det>`).join('');
  return `<nfeProc><NFe><infNFe><emit><CNPJ>${supplierCnpj}</CNPJ><xNome>${supplierName}</xNome></emit>${dets}</infNFe></NFe></nfeProc>`;
}

describe('Inventory Service — Ordens de Compra e Dashboard', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('15. Criar OC — calcula totalCents', async () => {
    const user = await createTestUser('inv15@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv15');
    const mat = await inventoryService.createMaterial(tenant.id, { name: 'Mat 15', unit: 'un', minStock: 0 }, user.id);

    const po = await inventoryService.createPurchaseOrder(tenant.id, {
      items: [
        { materialId: mat.id, quantity: 10, unitPriceCents: 5000 },
        { materialId: mat.id, quantity: 5, unitPriceCents: 3000 },
      ],
    }, user.id);

    expect(po.status).toBe('draft');
    expect(po.totalCents).toBe(10 * 5000 + 5 * 3000); // 65000
    expect(po.code).toMatch(/^PO-/);
  });

  it('16. Status: draft → sent → received — cadeia válida', async () => {
    const user = await createTestUser('inv16@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv16');
    const mat = await inventoryService.createMaterial(tenant.id, { name: 'Mat 16', unit: 'un', minStock: 0 }, user.id);
    const po = await inventoryService.createPurchaseOrder(tenant.id, {
      items: [{ materialId: mat.id, quantity: 10, unitPriceCents: 1000 }],
    }, user.id);

    const sent = await inventoryService.changePurchaseOrderStatus(tenant.id, { id: po.id, status: 'sent' }, user.id);
    expect(sent.status).toBe('sent');

    const received = await inventoryService.changePurchaseOrderStatus(tenant.id, { id: po.id, status: 'received' }, user.id);
    expect(received.status).toBe('received');
    expect(received.receivedAt).not.toBeNull();
  });

  it('17. Recebimento automático — cria movimentações de entrada para cada item (09.08)', async () => {
    const user = await createTestUser('inv17@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv17');
    const mat1 = await inventoryService.createMaterial(tenant.id, { name: 'Mat 17A', unit: 'un', minStock: 0 }, user.id);
    const mat2 = await inventoryService.createMaterial(tenant.id, { name: 'Mat 17B', unit: 'un', minStock: 0 }, user.id);

    const po = await inventoryService.createPurchaseOrder(tenant.id, {
      items: [
        { materialId: mat1.id, quantity: 20, unitPriceCents: 1000 },
        { materialId: mat2.id, quantity: 10, unitPriceCents: 2000 },
      ],
    }, user.id);

    await inventoryService.changePurchaseOrderStatus(tenant.id, { id: po.id, status: 'received' }, user.id);

    const m1 = await inventoryService.getMaterial(tenant.id, mat1.id);
    const m2 = await inventoryService.getMaterial(tenant.id, mat2.id);
    expect(Number(m1.currentStock)).toBe(20);
    expect(Number(m2.currentStock)).toBe(10);
  });

  it('18. Recebimento atualiza estoque e custo médio dos materiais', async () => {
    const user = await createTestUser('inv18@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv18');
    const mat = await inventoryService.createMaterial(tenant.id, { name: 'Mat 18', unit: 'un', minStock: 0 }, user.id);

    const po = await inventoryService.createPurchaseOrder(tenant.id, {
      items: [{ materialId: mat.id, quantity: 100, unitPriceCents: 5000 }],
    }, user.id);
    await inventoryService.changePurchaseOrderStatus(tenant.id, { id: po.id, status: 'received' }, user.id);

    const updated = await inventoryService.getMaterial(tenant.id, mat.id);
    expect(Number(updated.currentStock)).toBe(100);
    expect(updated.averageCostCents).toBe(5000);
    expect(updated.lastPurchasePriceCents).toBe(5000);
  });

  it('19. Import XML NF-e — parseia e cria OC em draft (09.09)', async () => {
    const user = await createTestUser('inv19@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv19');

    // Criar material com código para match
    await inventoryService.createMaterial(tenant.id, { name: 'Resina NF-e', unit: 'ml', minStock: 0, code: 'PROD001' }, user.id);

    const xml = makeNfeXml('12345678000190', 'Dental NF-e LTDA', [
      { name: 'Resina NF-e', qty: 50, price: 12.50 },
    ]);

    const po = await inventoryService.importNfeXml(tenant.id, xml, user.id);
    expect(po.status).toBe('draft');   // deve ser draft para revisão humana
    expect(po.code).toMatch(/^PO-/);
  });

  it('20. Dashboard retorna totais corretos (09.15)', async () => {
    const user = await createTestUser('inv20@test.com');
    const tenant = await createTestTenant(user.id, 'Lab Inv20');
    const mat1 = await inventoryService.createMaterial(tenant.id, { name: 'Mat OK', unit: 'un', minStock: 5 }, user.id);
    await inventoryService.createMaterial(tenant.id, { name: 'Mat Baixo', unit: 'un', minStock: 10 }, user.id);

    // mat1: entra 20 (acima do mínimo de 5)
    await inventoryService.createMovement(tenant.id, { materialId: mat1.id, type: 'in', quantity: 20, unitCostCents: 1000 }, user.id);
    // mat2: fica com 0 (abaixo do mínimo de 10)

    const dash = await inventoryService.getDashboard(tenant.id);
    expect(dash.totalMaterials).toBe(2);
    expect(dash.belowMinimum).toBe(1);         // mat2 abaixo do mínimo
    expect(dash.totalValueCents).toBe(20 * 1000); // 20 un × 1000 centavos
  });

  it('21. Materiais de tenant A invisíveis para B', async () => {
    const u1 = await createTestUser('inv21a@test.com');
    const u2 = await createTestUser('inv21b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab Inv21A');
    const t2 = await createTestTenant(u2.id, 'Lab Inv21B');

    await inventoryService.createMaterial(t1.id, { name: 'Mat Tenant A', unit: 'un', minStock: 0 }, u1.id);

    const { data } = await inventoryService.listMaterials(t2.id, { page: 1, limit: 20 });
    expect(data.length).toBe(0);
  });

  it('22. Movimentações de tenant A invisíveis para B', async () => {
    const u1 = await createTestUser('inv22a@test.com');
    const u2 = await createTestUser('inv22b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab Inv22A');
    const t2 = await createTestTenant(u2.id, 'Lab Inv22B');

    const mat = await inventoryService.createMaterial(t1.id, { name: 'Mat 22', unit: 'un', minStock: 0 }, u1.id);
    await inventoryService.createMovement(t1.id, { materialId: mat.id, type: 'in', quantity: 10, unitCostCents: 100 }, u1.id);

    const { data } = await inventoryService.listMovements(t2.id, { limit: 20 });
    expect(data.length).toBe(0);
  });
});
