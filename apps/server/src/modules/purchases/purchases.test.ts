/**
 * F35 — Purchases Service Tests
 * 8 cenários cobrindo o fluxo completo e restrições críticas.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';
import { users, tenants, tenantMembers } from '../../db/schema/index.js';
import {
  suppliers,
  materials,
  purchaseOrders,
  purchaseOrderItems,
  stockMovements,
  materialCategories,
} from '../../db/schema/materials.js';
import { accountsPayable } from '../../db/schema/financials.js';
import { hashPassword } from '../../core/auth.js';
import * as purchasesService from './service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function createTestSupplier(tenantId: number) {
  const [sup] = await db.insert(suppliers).values({
    tenantId,
    name: 'Dental Supplies LTDA',
    cnpj: '12.345.678/0001-90',
    isActive: true,
  }).returning();
  return sup!;
}

async function createTestMaterial(tenantId: number, userId: number, name: string = 'Resina A3') {
  const [mat] = await db.insert(materials).values({
    tenantId,
    name,
    unit: 'ml',
    averageCostCents: 0,
    createdBy: userId,
  }).returning();
  return mat!;
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  await db.execute(sql`DELETE FROM audit_logs`).catch(() => {});
  await db.delete(accountsPayable);
  await db.delete(stockMovements);
  await db.delete(purchaseOrderItems);
  await db.delete(purchaseOrders);
  await db.delete(materials);
  await db.delete(materialCategories);
  await db.delete(suppliers);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('F35 — Purchases Service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. Criar compra (draft) — status correto e totalCents calculado', async () => {
    const user = await createTestUser('p1@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P1');
    const sup = await createTestSupplier(tenant.id);
    const mat = await createTestMaterial(tenant.id, user.id);

    const po = await purchasesService.createPurchase(tenant.id, {
      supplierId: sup.id,
      items: [
        { materialId: mat.id, quantity: 10, unitPriceCents: 5000 },
        { materialId: mat.id, quantity: 5, unitPriceCents: 3000 },
      ],
    }, user.id);

    expect(po.status).toBe('draft');
    expect(po.supplierId).toBe(sup.id);
    expect(po.totalCents).toBe(10 * 5000 + 5 * 3000); // 65000
    expect(po.code).toMatch(/^CMP-/);
    expect(po.tenantId).toBe(tenant.id);
  });

  it('2. Confirmar compra (draft → sent)', async () => {
    const user = await createTestUser('p2@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P2');
    const sup = await createTestSupplier(tenant.id);
    const mat = await createTestMaterial(tenant.id, user.id);

    const po = await purchasesService.createPurchase(tenant.id, {
      supplierId: sup.id,
      items: [{ materialId: mat.id, quantity: 5, unitPriceCents: 1000 }],
    }, user.id);

    const confirmed = await purchasesService.confirmPurchase(tenant.id, po.id, user.id);
    expect(confirmed.status).toBe('sent');
  });

  it('3. Receber compra → estoque atualizado + AP criado (CRÍTICO — AP-13 + AP-14)', async () => {
    const user = await createTestUser('p3@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P3');
    const sup = await createTestSupplier(tenant.id);
    const mat1 = await createTestMaterial(tenant.id, user.id, 'Gesso IV');
    const mat2 = await createTestMaterial(tenant.id, user.id, 'Resina B2');

    // Criar e confirmar
    const po = await purchasesService.createPurchase(tenant.id, {
      supplierId: sup.id,
      items: [
        { materialId: mat1.id, quantity: 50, unitPriceCents: 2000 },
        { materialId: mat2.id, quantity: 20, unitPriceCents: 5000 },
      ],
    }, user.id);
    await purchasesService.confirmPurchase(tenant.id, po.id, user.id);

    // Receber
    const { purchase, ap } = await purchasesService.receivePurchase(tenant.id, po.id, user.id);

    // 1. Status da OC
    expect(purchase.status).toBe('received');

    // 2. Estoque atualizado
    const [m1] = await db.select({ stock: materials.currentStock })
      .from(materials).where(sql`id = ${mat1.id}`);
    const [m2] = await db.select({ stock: materials.currentStock })
      .from(materials).where(sql`id = ${mat2.id}`);
    expect(Number(m1!.stock)).toBe(50);
    expect(Number(m2!.stock)).toBe(20);

    // 3. Lançamento AP criado
    expect(ap.status).toBe('pending');
    expect(ap.amountCents).toBe(50 * 2000 + 20 * 5000); // 200000
    expect(ap.referenceId).toBe(po.id);
    expect(ap.referenceType).toBe('purchase_order');
    expect(ap.supplierId).toBe(sup.id);
  });

  it('4. Tentar receber compra em draft → REJEITA', async () => {
    const user = await createTestUser('p4@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P4');
    const sup = await createTestSupplier(tenant.id);
    const mat = await createTestMaterial(tenant.id, user.id);

    const po = await purchasesService.createPurchase(tenant.id, {
      supplierId: sup.id,
      items: [{ materialId: mat.id, quantity: 5, unitPriceCents: 1000 }],
    }, user.id);

    await expect(
      purchasesService.receivePurchase(tenant.id, po.id, user.id),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('5. Cancelar compra confirmada → soft delete', async () => {
    const user = await createTestUser('p5@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P5');
    const sup = await createTestSupplier(tenant.id);
    const mat = await createTestMaterial(tenant.id, user.id);

    const po = await purchasesService.createPurchase(tenant.id, {
      supplierId: sup.id,
      items: [{ materialId: mat.id, quantity: 5, unitPriceCents: 1000 }],
    }, user.id);
    await purchasesService.confirmPurchase(tenant.id, po.id, user.id);

    const cancelled = await purchasesService.cancelPurchase(tenant.id, po.id, user.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.deletedAt).not.toBeNull();
    expect(cancelled.deletedBy).toBe(user.id);

    // Soft delete: compra cancelada nao deve aparecer na listagem ativa.
    const { data } = await purchasesService.listPurchases(tenant.id, { page: 1, limit: 20 });
    const found = data.find((r) => r.po.id === po.id);
    expect(found).toBeUndefined();
  });

  it('6. Cancelar compra recebida → REJEITA', async () => {
    const user = await createTestUser('p6@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P6');
    const sup = await createTestSupplier(tenant.id);
    const mat = await createTestMaterial(tenant.id, user.id);

    const po = await purchasesService.createPurchase(tenant.id, {
      supplierId: sup.id,
      items: [{ materialId: mat.id, quantity: 5, unitPriceCents: 1000 }],
    }, user.id);
    await purchasesService.confirmPurchase(tenant.id, po.id, user.id);
    await purchasesService.receivePurchase(tenant.id, po.id, user.id);

    await expect(
      purchasesService.cancelPurchase(tenant.id, po.id, user.id),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('7. Tenant isolation — compra de tenant A invisível para B', async () => {
    const u1 = await createTestUser('p7a@test.com');
    const u2 = await createTestUser('p7b@test.com');
    const t1 = await createTestTenant(u1.id, 'Lab P7A');
    const t2 = await createTestTenant(u2.id, 'Lab P7B');

    const sup = await createTestSupplier(t1.id);
    const mat = await createTestMaterial(t1.id, u1.id);

    await purchasesService.createPurchase(t1.id, {
      supplierId: sup.id,
      items: [{ materialId: mat.id, quantity: 5, unitPriceCents: 1000 }],
    }, u1.id);

    const { data } = await purchasesService.listPurchases(t2.id, { page: 1, limit: 20 });
    expect(data.length).toBe(0);
  });

  it('8. AP gerado tem referenceId correto (rastreabilidade F35)', async () => {
    const user = await createTestUser('p8@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P8');
    const sup = await createTestSupplier(tenant.id);
    const mat = await createTestMaterial(tenant.id, user.id);

    const po = await purchasesService.createPurchase(tenant.id, {
      supplierId: sup.id,
      items: [{ materialId: mat.id, quantity: 100, unitPriceCents: 3000 }],
    }, user.id);
    await purchasesService.confirmPurchase(tenant.id, po.id, user.id);
    const { ap } = await purchasesService.receivePurchase(
      tenant.id,
      po.id,
      user.id,
      new Date('2026-05-15'),
    );

    // Rastreabilidade: AP aponta de volta para a OC
    expect(ap.referenceId).toBe(po.id);
    expect(ap.referenceType).toBe('purchase_order');
    expect(ap.amountCents).toBe(100 * 3000);
    // Data de vencimento customizada respeitada
    expect(ap.dueDate.toISOString().startsWith('2026-05-15')).toBe(true);
  });

  it('9. Código sequencial por tenant com lock transacional', async () => {
    const user = await createTestUser('p9@test.com');
    const tenant = await createTestTenant(user.id, 'Lab P9');
    const sup = await createTestSupplier(tenant.id);
    const mat = await createTestMaterial(tenant.id, user.id);

    const created = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        purchasesService.createPurchase(tenant.id, {
          supplierId: sup.id,
          items: [{ materialId: mat.id, quantity: 1, unitPriceCents: 1000 }],
        }, user.id),
      ),
    );

    const codes = created.map((po) => po.code);
    const uniqueCodes = new Set(codes);

    expect(uniqueCodes.size).toBe(5);
    expect(codes).toContain('CMP-00001');
    expect(codes).toContain('CMP-00002');
    expect(codes).toContain('CMP-00003');
    expect(codes).toContain('CMP-00004');
    expect(codes).toContain('CMP-00005');
  });
});
