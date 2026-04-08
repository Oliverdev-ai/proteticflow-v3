import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, ilike, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { CreatePurchaseInput, ListPurchasesInput, UpdatePurchaseInput } from '@proteticflow/shared';
import { db } from '../../db/index.js';
import { accountsPayable } from '../../db/schema/financials.js';
import {
  materials,
  purchaseOrderItems,
  purchaseOrders,
  stockMovements,
  suppliers,
} from '../../db/schema/materials.js';
import { logger } from '../../logger.js';
import { logAudit } from '../audit/service.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function getNextPoCodeWithLock(tx: Tx, tenantId: number): Promise<string> {
  // Serializa geracao do codigo por tenant para evitar corrida.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(35, ${tenantId})`);

  const rows = await tx
    .select({
      nextNumber: sql<number>`COALESCE(MAX(NULLIF(regexp_replace(${purchaseOrders.code}, '[^0-9]', '', 'g'), '')::integer), 0) + 1`,
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.tenantId, tenantId));

  const nextNumber = Number(rows[0]?.nextNumber ?? 1);
  return `CMP-${String(nextNumber).padStart(5, '0')}`;
}

export async function createPurchase(
  tenantId: number,
  input: CreatePurchaseInput,
  userId: number,
): Promise<typeof purchaseOrders.$inferSelect> {
  const totalCents = input.items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPriceCents),
    0,
  );

  return db.transaction(async (tx) => {
    const [supplier] = await tx
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.id, input.supplierId),
          eq(suppliers.tenantId, tenantId),
          isNull(suppliers.deletedAt),
        ),
      );

    if (!supplier) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Fornecedor não encontrado' });
    }

    const materialIds = [...new Set(input.items.map((item) => item.materialId))];
    const existingMaterials = await tx
      .select({ id: materials.id })
      .from(materials)
      .where(
        and(
          eq(materials.tenantId, tenantId),
          isNull(materials.deletedAt),
          inArray(materials.id, materialIds),
        ),
      );

    if (existingMaterials.length !== materialIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Um ou mais materiais não pertencem ao tenant atual',
      });
    }

    const code = await getNextPoCodeWithLock(tx, tenantId);

    const [po] = await tx
      .insert(purchaseOrders)
      .values({
        tenantId,
        supplierId: input.supplierId,
        code,
        status: 'draft',
        totalCents,
        notes: input.notes ?? null,
        createdBy: userId,
      })
      .returning();

    if (!po) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar compra' });
    }

    await tx.insert(purchaseOrderItems).values(
      input.items.map((item) => ({
        tenantId,
        purchaseOrderId: po.id,
        materialId: item.materialId,
        quantity: String(item.quantity),
        unitPriceCents: item.unitPriceCents,
        totalCents: Math.round(item.quantity * item.unitPriceCents),
      })),
    );

    logger.info({ tenantId, poId: po.id, code, totalCents }, 'purchases.create');
    return po;
  });
}

export async function listPurchases(tenantId: number, filters: ListPurchasesInput) {
  const conditions = [eq(purchaseOrders.tenantId, tenantId), isNull(purchaseOrders.deletedAt)];

  if (filters.status) {
    conditions.push(eq(purchaseOrders.status, filters.status));
  }
  if (filters.supplierId) {
    conditions.push(eq(purchaseOrders.supplierId, filters.supplierId));
  }
  if (filters.dateFrom) {
    conditions.push(gte(purchaseOrders.createdAt, new Date(filters.dateFrom)));
  }
  if (filters.dateTo) {
    conditions.push(lte(purchaseOrders.createdAt, new Date(filters.dateTo)));
  }

  const offset = (filters.page - 1) * filters.limit;

  const rows = await db
    .select({
      po: purchaseOrders,
      supplierName: suppliers.name,
      supplierDocument: suppliers.cnpj,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(and(...conditions))
    .orderBy(desc(purchaseOrders.createdAt))
    .limit(filters.limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(purchaseOrders)
    .where(and(...conditions));

  return { data: rows, total: Number(countRows[0]?.count ?? 0) };
}

export async function getPurchase(tenantId: number, poId: number) {
  const [row] = await db
    .select({
      po: purchaseOrders,
      supplierName: suppliers.name,
      supplierCnpj: suppliers.cnpj,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(
      and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, tenantId),
        isNull(purchaseOrders.deletedAt),
      ),
    );

  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Compra não encontrada' });
  }

  const items = await db
    .select({
      item: purchaseOrderItems,
      materialName: materials.name,
      materialUnit: materials.unit,
    })
    .from(purchaseOrderItems)
    .leftJoin(materials, eq(purchaseOrderItems.materialId, materials.id))
    .where(
      and(
        eq(purchaseOrderItems.purchaseOrderId, poId),
        eq(purchaseOrderItems.tenantId, tenantId),
      ),
    );

  return { ...row, items };
}

export async function updatePurchase(tenantId: number, poId: number, input: UpdatePurchaseInput) {
  const [po] = await db
    .select({ status: purchaseOrders.status })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, tenantId),
        isNull(purchaseOrders.deletedAt),
      ),
    );

  if (!po) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Compra não encontrada' });
  }
  if (po.status !== 'draft') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Só é possível editar compras em rascunho' });
  }

  const updateData: Partial<typeof purchaseOrders.$inferInsert> = { updatedAt: new Date() };
  if (input.supplierId !== undefined) updateData.supplierId = input.supplierId;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const [updated] = await db
    .update(purchaseOrders)
    .set(updateData)
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId)))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Compra não encontrada' });
  }
  return updated;
}

export async function confirmPurchase(tenantId: number, poId: number, userId: number) {
  const [po] = await db
    .select({ status: purchaseOrders.status })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, tenantId),
        isNull(purchaseOrders.deletedAt),
      ),
    );

  if (!po) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Compra não encontrada' });
  }
  if (po.status !== 'draft') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Transição inválida: ${po.status} -> sent` });
  }

  const [updated] = await db
    .update(purchaseOrders)
    .set({ status: 'sent', updatedAt: new Date() })
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId)))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Compra não encontrada' });
  }
  logger.info({ tenantId, poId, userId }, 'purchases.confirm');
  return updated;
}

export async function receivePurchase(
  tenantId: number,
  poId: number,
  userId: number,
  dueDateOverride?: Date,
) {
  const dueDate = dueDateOverride ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return db.transaction(async (tx) => {
    const [purchase] = await tx
      .select({
        po: purchaseOrders,
        supplierName: suppliers.name,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(
        and(
          eq(purchaseOrders.id, poId),
          eq(purchaseOrders.tenantId, tenantId),
          isNull(purchaseOrders.deletedAt),
        ),
      );

    if (!purchase) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Compra não encontrada' });
    }
    if (purchase.po.status !== 'sent') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Somente compras confirmadas podem ser recebidas. Status atual: ${purchase.po.status}`,
      });
    }

    const items = await tx
      .select({
        item: purchaseOrderItems,
        materialName: materials.name,
      })
      .from(purchaseOrderItems)
      .leftJoin(materials, eq(purchaseOrderItems.materialId, materials.id))
      .where(
        and(
          eq(purchaseOrderItems.purchaseOrderId, poId),
          eq(purchaseOrderItems.tenantId, tenantId),
        ),
      );

    if (items.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Compra sem itens não pode ser recebida' });
    }

    for (const { item, materialName } of items) {
      const qty = Number(item.quantity);
      const unitCost = item.unitPriceCents;

      await tx.execute(sql`
        UPDATE materials SET
          current_stock = current_stock + ${qty}::numeric,
          average_cost_cents = CASE
            WHEN (current_stock + ${qty}::numeric) = 0 THEN ${unitCost}::integer
            ELSE ROUND(
              (current_stock * average_cost_cents + ${qty}::numeric * ${unitCost}::numeric)
              / NULLIF(current_stock + ${qty}::numeric, 0)
            )::integer
          END,
          last_purchase_price_cents = ${unitCost}::integer,
          updated_at = NOW()
        WHERE tenant_id = ${tenantId} AND id = ${item.materialId} AND deleted_at IS NULL
      `);

      const [material] = await tx
        .select({ currentStock: materials.currentStock })
        .from(materials)
        .where(and(eq(materials.id, item.materialId), eq(materials.tenantId, tenantId)));

      if (!material) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Material ${item.materialId} inválido para o tenant`,
        });
      }

      await tx.insert(stockMovements).values({
        tenantId,
        materialId: item.materialId,
        type: 'in',
        quantity: String(qty),
        stockAfter: material.currentStock,
        reason: `Recebimento ${purchase.po.code} - ${materialName ?? 'Material'}`,
        supplierId: purchase.po.supplierId ?? null,
        purchaseOrderId: purchase.po.id,
        unitCostCents: unitCost,
        createdBy: userId,
      });
    }

    const [ap] = await tx
      .insert(accountsPayable)
      .values({
        tenantId,
        description: `Compra ${purchase.po.code} - ${purchase.supplierName ?? 'Fornecedor'}`,
        supplierId: purchase.po.supplierId ?? null,
        supplier: purchase.supplierName ?? null,
        amountCents: purchase.po.totalCents,
        dueDate,
        status: 'pending',
        category: 'fornecedor',
        reference: purchase.po.code,
        referenceId: purchase.po.id,
        referenceType: 'purchase_order',
        createdBy: userId,
        issuedAt: new Date(),
      })
      .returning();

    if (!ap) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Falha ao criar lançamento em contas a pagar',
      });
    }

    const [poUpdated] = await tx
      .update(purchaseOrders)
      .set({
        status: 'received',
        receivedAt: new Date(),
        receivedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(purchaseOrders.id, poId),
          eq(purchaseOrders.tenantId, tenantId),
          eq(purchaseOrders.status, 'sent'),
          isNull(purchaseOrders.deletedAt),
        ),
      )
      .returning();

    if (!poUpdated) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Compra já foi processada por outra operação',
      });
    }

    logger.info(
      {
        tenantId,
        poId,
        userId,
        itemCount: items.length,
        totalCents: purchase.po.totalCents,
        apId: ap.id,
      },
      'purchases.receive',
    );

    void logAudit({
      tenantId,
      userId,
      action: 'purchases.receive',
      entityType: 'purchase_orders',
      entityId: poId,
      oldValue: { status: purchase.po.status },
      newValue: { status: 'received', apId: ap.id, receivedBy: userId },
    });

    return { purchase: poUpdated, ap };
  });
}

export async function cancelPurchase(tenantId: number, poId: number, userId: number) {
  const [po] = await db
    .select({ status: purchaseOrders.status })
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, tenantId),
        isNull(purchaseOrders.deletedAt),
      ),
    );

  if (!po) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Compra não encontrada' });
  }
  if (po.status === 'received') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Não é possível cancelar compra já recebida. Faça estorno manual.',
    });
  }
  if (po.status === 'cancelled') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Compra já está cancelada' });
  }

  const now = new Date();
  const [updated] = await db
    .update(purchaseOrders)
    .set({
      status: 'cancelled',
      cancelledAt: now,
      deletedAt: now,
      deletedBy: userId,
      updatedAt: now,
    })
    .where(
      and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.tenantId, tenantId),
        isNull(purchaseOrders.deletedAt),
      ),
    )
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Compra não encontrada' });
  }
  logger.info({ tenantId, poId, userId }, 'purchases.cancel');
  void logAudit({
    tenantId,
    userId,
    action: 'purchases.cancel',
    entityType: 'purchase_orders',
    entityId: poId,
    oldValue: { status: po.status },
    newValue: { status: 'cancelled' },
  });

  return updated;
}

export async function listSuppliersForPurchase(tenantId: number, search?: string) {
  const conditions = [eq(suppliers.tenantId, tenantId), isNull(suppliers.deletedAt), eq(suppliers.isActive, true)];

  if (search) {
    conditions.push(ilike(suppliers.name, `%${search}%`));
  }

  return db
    .select({ id: suppliers.id, name: suppliers.name, cnpj: suppliers.cnpj })
    .from(suppliers)
    .where(and(...conditions))
    .orderBy(suppliers.name)
    .limit(50);
}

export async function listMaterialsForPurchase(tenantId: number, search?: string) {
  const conditions = [eq(materials.tenantId, tenantId), isNull(materials.deletedAt), eq(materials.isActive, true)];

  if (search) {
    conditions.push(sql`${materials.name} ILIKE ${`%${search}%`} OR ${materials.code} ILIKE ${`%${search}%`}`);
  }

  return db
    .select({
      id: materials.id,
      name: materials.name,
      code: materials.code,
      unit: materials.unit,
      lastPurchasePriceCents: materials.lastPurchasePriceCents,
    })
    .from(materials)
    .where(and(...conditions))
    .orderBy(materials.name)
    .limit(50);
}
