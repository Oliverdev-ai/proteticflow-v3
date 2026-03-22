import { eq, and, ilike, or, lt, gt, gte, lte, sql, isNull, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  materialCategories, suppliers, materials, stockMovements,
  purchaseOrders, purchaseOrderItems,
} from '../../db/schema/index.js';
import { TRPCError } from '@trpc/server';
import { logger } from '../../logger.js';
import {
  CreateCategoryInput, CreateSupplierInput, ListSuppliersInput,
  CreateMaterialInput, ListMaterialsInput,
  CreateMovementInput, ListMovementsInput,
  CreatePurchaseOrderInput, ListPurchaseOrdersInput, ChangePurchaseOrderStatusInput,
} from '@proteticflow/shared';
import { XMLParser } from 'fast-xml-parser';

// ─── Categorias ───────────────────────────────────────────────────────────────

export async function createCategory(tenantId: number, input: CreateCategoryInput) {
  const [cat] = await db.insert(materialCategories).values({
    tenantId, name: input.name, description: input.description, color: input.color ?? 'slate',
  }).returning();
  return cat!;
}

export async function listCategories(tenantId: number) {
  return db.select().from(materialCategories)
    .where(and(eq(materialCategories.tenantId, tenantId), isNull(materialCategories.deletedAt)))
    .orderBy(materialCategories.name);
}

export async function updateCategory(tenantId: number, categoryId: number, input: Partial<CreateCategoryInput>) {
  const [cat] = await db.update(materialCategories)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(materialCategories.id, categoryId), eq(materialCategories.tenantId, tenantId)))
    .returning();
  if (!cat) throw new TRPCError({ code: 'NOT_FOUND', message: 'Categoria não encontrada' });
  return cat;
}

export async function deleteCategory(tenantId: number, categoryId: number) {
  await db.update(materialCategories)
    .set({ deletedAt: new Date() })
    .where(and(eq(materialCategories.id, categoryId), eq(materialCategories.tenantId, tenantId)));
}

// ─── Fornecedores ─────────────────────────────────────────────────────────────

export async function createSupplier(tenantId: number, input: CreateSupplierInput) {
  const [sup] = await db.insert(suppliers).values({
    tenantId, ...input,
  }).returning();
  return sup!;
}

export async function listSuppliers(tenantId: number, filters: ListSuppliersInput) {
  const conditions = [eq(suppliers.tenantId, tenantId), isNull(suppliers.deletedAt)];
  if (filters.search) conditions.push(ilike(suppliers.name, `%${filters.search}%`));
  if (filters.isActive !== undefined) conditions.push(eq(suppliers.isActive, filters.isActive));

  const offset = (filters.page - 1) * filters.limit;
  const data = await db.select().from(suppliers)
    .where(and(...conditions)).orderBy(suppliers.name).limit(filters.limit).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(suppliers).where(and(...conditions));
  return { data, total: Number(count) };
}

export async function getSupplier(tenantId: number, supplierId: number) {
  const [sup] = await db.select().from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenantId), isNull(suppliers.deletedAt)));
  if (!sup) throw new TRPCError({ code: 'NOT_FOUND', message: 'Fornecedor não encontrado' });
  return sup;
}

export async function updateSupplier(tenantId: number, supplierId: number, input: Partial<CreateSupplierInput>) {
  const [sup] = await db.update(suppliers).set({ ...input, updatedAt: new Date() })
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenantId))).returning();
  if (!sup) throw new TRPCError({ code: 'NOT_FOUND', message: 'Fornecedor não encontrado' });
  return sup;
}

export async function toggleSupplierActive(tenantId: number, supplierId: number) {
  const sup = await getSupplier(tenantId, supplierId);
  const [updated] = await db.update(suppliers).set({ isActive: !sup.isActive, updatedAt: new Date() })
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.tenantId, tenantId))).returning();
  return updated!;
}

// ─── Materiais ────────────────────────────────────────────────────────────────

export async function createMaterial(tenantId: number, input: CreateMaterialInput, userId: number) {
  const [mat] = await db.insert(materials).values({
    tenantId,
    name: input.name,
    code: input.code,
    barcode: input.barcode,
    description: input.description,
    categoryId: input.categoryId,
    supplierId: input.supplierId,
    unit: input.unit ?? 'un',
    minStock: String(input.minStock ?? 0),
    maxStock: input.maxStock !== undefined ? String(input.maxStock) : undefined,
    notes: input.notes,
    createdBy: userId,
  }).returning();
  return mat!;
}

export async function listMaterials(tenantId: number, filters: ListMaterialsInput) {
  const conditions = [eq(materials.tenantId, tenantId), isNull(materials.deletedAt)];
  if (filters.search) {
    conditions.push(or(
      ilike(materials.name, `%${filters.search}%`),
      ilike(materials.code, `%${filters.search}%`),
      ilike(materials.barcode, `%${filters.search}%`),
    )!);
  }
  if (filters.categoryId) conditions.push(eq(materials.categoryId, filters.categoryId));
  if (filters.belowMinimum) {
    // currentStock < minStock where minStock > 0
    conditions.push(sql`${materials.currentStock} < ${materials.minStock} AND ${materials.minStock} > 0`);
  }
  if (filters.isActive !== undefined) conditions.push(eq(materials.isActive, filters.isActive));

  const offset = (filters.page - 1) * filters.limit;
  const data = await db.select().from(materials)
    .where(and(...conditions)).orderBy(materials.name).limit(filters.limit).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(materials).where(and(...conditions));
  return { data, total: Number(count) };
}

export async function getMaterial(tenantId: number, materialId: number) {
  const [mat] = await db.select().from(materials)
    .where(and(eq(materials.id, materialId), eq(materials.tenantId, tenantId), isNull(materials.deletedAt)));
  if (!mat) throw new TRPCError({ code: 'NOT_FOUND', message: 'Material não encontrado' });
  return mat;
}

export async function updateMaterial(tenantId: number, materialId: number, input: Partial<CreateMaterialInput>) {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.code !== undefined) updateData.code = input.code;
  if (input.barcode !== undefined) updateData.barcode = input.barcode;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
  if (input.supplierId !== undefined) updateData.supplierId = input.supplierId;
  if (input.unit !== undefined) updateData.unit = input.unit;
  if (input.minStock !== undefined) updateData.minStock = String(input.minStock);
  if (input.maxStock !== undefined) updateData.maxStock = String(input.maxStock);
  if (input.notes !== undefined) updateData.notes = input.notes;

  const [mat] = await db.update(materials).set(updateData)
    .where(and(eq(materials.id, materialId), eq(materials.tenantId, tenantId))).returning();
  if (!mat) throw new TRPCError({ code: 'NOT_FOUND', message: 'Material não encontrado' });
  return mat;
}

export async function toggleMaterialActive(tenantId: number, materialId: number) {
  const mat = await getMaterial(tenantId, materialId);
  const [updated] = await db.update(materials).set({ isActive: !mat.isActive, updatedAt: new Date() })
    .where(and(eq(materials.id, materialId), eq(materials.tenantId, tenantId))).returning();
  return updated!;
}

// ─── Movimentações (AP-13: UPDATE ATÔMICO) ───────────────────────────────────

export async function createMovement(tenantId: number, input: CreateMovementInput, userId: number) {
  const qty = input.quantity;
  const unitCost = input.unitCostCents ?? 0;

  let stockAfterResult: number;

  if (input.type === 'in') {
    // AP-13 + 09.05: custo médio ponderado no mesmo UPDATE atômico
    const [updated] = await db.execute<{ current_stock: string; }>(sql`
      UPDATE materials SET
        current_stock = current_stock + ${qty},
        average_cost_cents = CASE
          WHEN (current_stock + ${qty}) = 0 THEN ${unitCost}
          ELSE ROUND((current_stock * average_cost_cents + ${qty} * ${unitCost}) / (current_stock + ${qty}))
        END,
        last_purchase_price_cents = ${unitCost},
        updated_at = NOW()
      WHERE tenant_id = ${tenantId} AND id = ${input.materialId} AND deleted_at IS NULL
      RETURNING current_stock
    `);
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Material não encontrado' });
    stockAfterResult = Number(updated.current_stock);

  } else if (input.type === 'out') {
    // AP-13: WHERE current_stock >= qty — se rows = 0 → estoque insuficiente
    const [updated] = await db.execute<{ current_stock: string; }>(sql`
      UPDATE materials SET
        current_stock = current_stock - ${qty},
        updated_at = NOW()
      WHERE tenant_id = ${tenantId} AND id = ${input.materialId} AND current_stock >= ${qty} AND deleted_at IS NULL
      RETURNING current_stock
    `);
    if (!updated) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Estoque insuficiente para realizar a saída' });
    }
    stockAfterResult = Number(updated.current_stock);

  } else {
    // adjustment: setar valor absoluto
    const [updated] = await db.execute<{ current_stock: string; }>(sql`
      UPDATE materials SET
        current_stock = ${qty},
        updated_at = NOW()
      WHERE tenant_id = ${tenantId} AND id = ${input.materialId} AND deleted_at IS NULL
      RETURNING current_stock
    `);
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Material não encontrado' });
    stockAfterResult = Number(updated.current_stock);
  }

  // Insert de movimentação com stockAfter correto
  const [movement] = await db.insert(stockMovements).values({
    tenantId,
    materialId: input.materialId,
    type: input.type,
    quantity: String(qty),
    stockAfter: String(stockAfterResult),
    reason: input.reason,
    jobId: input.jobId,
    supplierId: input.supplierId,
    purchaseOrderId: input.purchaseOrderId,
    invoiceNumber: input.invoiceNumber,
    unitCostCents: unitCost || null,
    notes: input.notes,
    createdBy: userId,
  }).returning();

  logger.info({ tenantId, materialId: input.materialId, type: input.type, quantity: qty, stockAfter: stockAfterResult }, 'inventory.movement');
  return movement!;
}

export async function listMovements(tenantId: number, filters: ListMovementsInput) {
  const conditions = [eq(stockMovements.tenantId, tenantId)];
  if (filters.materialId) conditions.push(eq(stockMovements.materialId, filters.materialId));
  if (filters.type) conditions.push(eq(stockMovements.type, filters.type));
  if (filters.dateFrom) conditions.push(gte(stockMovements.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(stockMovements.createdAt, new Date(filters.dateTo)));
  if (filters.cursor) conditions.push(lt(stockMovements.id, filters.cursor));

  const data = await db.select({
    movement: stockMovements,
    materialName: materials.name,
  }).from(stockMovements)
    .leftJoin(materials, eq(stockMovements.materialId, materials.id))
    .where(and(...conditions))
    .orderBy(desc(stockMovements.id))
    .limit(filters.limit);

  const nextCursor = data.length === filters.limit ? data[data.length - 1]?.movement.id : undefined;
  return { data, nextCursor };
}

export async function consumeForJob(tenantId: number, materialId: number, quantity: number, jobId: number, userId: number) {
  return createMovement(tenantId, { materialId, type: 'out', quantity, jobId }, userId);
}

export async function getDashboard(tenantId: number) {
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(materials)
    .where(and(eq(materials.tenantId, tenantId), eq(materials.isActive, true), isNull(materials.deletedAt)));

  const [{ belowMin }] = await db.select({ belowMin: sql<number>`count(*)` }).from(materials)
    .where(and(
      eq(materials.tenantId, tenantId),
      eq(materials.isActive, true),
      isNull(materials.deletedAt),
      sql`${materials.currentStock} < ${materials.minStock} AND ${materials.minStock} > 0`,
    ));

  const [{ totalValue }] = await db.select({
    totalValue: sql<number>`SUM(CAST(${materials.currentStock} AS numeric) * ${materials.averageCostCents})`,
  }).from(materials)
    .where(and(eq(materials.tenantId, tenantId), eq(materials.isActive, true), isNull(materials.deletedAt)));

  const [{ pendingPOs }] = await db.select({ pendingPOs: sql<number>`count(*)` }).from(purchaseOrders)
    .where(and(eq(purchaseOrders.tenantId, tenantId), eq(purchaseOrders.status, 'sent'), isNull(purchaseOrders.deletedAt)));

  return {
    totalMaterials: Number(total),
    belowMinimum: Number(belowMin),
    totalValueCents: Number(totalValue || 0),
    pendingPOs: Number(pendingPOs),
  };
}

// ─── Ordens de Compra ─────────────────────────────────────────────────────────

async function getNextPoCode(tenantId: number): Promise<string> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders)
    .where(eq(purchaseOrders.tenantId, tenantId));
  return `PO-${String(Number(count) + 1).padStart(5, '0')}`;
}

export async function createPurchaseOrder(tenantId: number, input: CreatePurchaseOrderInput, userId: number) {
  const code = await getNextPoCode(tenantId);
  const totalCents = input.items.reduce((s, i) => s + Math.round(i.quantity * i.unitPriceCents), 0);

  return db.transaction(async (tx) => {
    const [po] = await tx.insert(purchaseOrders).values({
      tenantId, supplierId: input.supplierId, code, notes: input.notes, totalCents, createdBy: userId,
    }).returning();

    await tx.insert(purchaseOrderItems).values(
      input.items.map(i => ({
        tenantId,
        purchaseOrderId: po!.id,
        materialId: i.materialId,
        quantity: String(i.quantity),
        unitPriceCents: i.unitPriceCents,
        totalCents: Math.round(i.quantity * i.unitPriceCents),
      }))
    );

    logger.info({ tenantId, poId: po!.id, totalCents, itemCount: input.items.length }, 'inventory.po.create');
    return po!;
  });
}

export async function listPurchaseOrders(tenantId: number, filters: ListPurchaseOrdersInput) {
  const conditions = [eq(purchaseOrders.tenantId, tenantId), isNull(purchaseOrders.deletedAt)];
  if (filters.status) conditions.push(eq(purchaseOrders.status, filters.status));
  if (filters.supplierId) conditions.push(eq(purchaseOrders.supplierId, filters.supplierId));
  if (filters.dateFrom) conditions.push(gte(purchaseOrders.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(purchaseOrders.createdAt, new Date(filters.dateTo)));

  const offset = (filters.page - 1) * filters.limit;
  const data = await db.select().from(purchaseOrders)
    .where(and(...conditions)).orderBy(desc(purchaseOrders.createdAt)).limit(filters.limit).offset(offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders).where(and(...conditions));
  return { data, total: Number(count) };
}

export async function getPurchaseOrder(tenantId: number, poId: number) {
  const [po] = await db.select().from(purchaseOrders)
    .where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.tenantId, tenantId), isNull(purchaseOrders.deletedAt)));
  if (!po) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ordem de compra não encontrada' });

  const items = await db.select({
    item: purchaseOrderItems,
    materialName: materials.name,
  }).from(purchaseOrderItems)
    .leftJoin(materials, eq(purchaseOrderItems.materialId, materials.id))
    .where(and(eq(purchaseOrderItems.purchaseOrderId, poId), eq(purchaseOrderItems.tenantId, tenantId)));

  return { po, items };
}

const VALID_PO_TRANSITIONS: Record<string, string[]> = {
  draft:     ['sent', 'cancelled'],
  sent:      ['received', 'cancelled'],
  received:  [],
  cancelled: [],
};

export async function changePurchaseOrderStatus(tenantId: number, input: ChangePurchaseOrderStatusInput, userId: number) {
  const { po, items } = await getPurchaseOrder(tenantId, input.id);
  const allowed = VALID_PO_TRANSITIONS[po.status] ?? [];
  if (!allowed.includes(input.status)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Transição inválida: ${po.status} → ${input.status}` });
  }

  if (input.status === 'received') {
    // 09.08: recebimento automático — transação cria N movimentações de entrada
    return db.transaction(async (tx) => {
      // Atualizar OC
      const [updated] = await tx.update(purchaseOrders)
        .set({ status: 'received', receivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.tenantId, tenantId)))
        .returning();

      // Criar movimentação de entrada para cada item (usando createMovement sem tx — reuse da lógica atômica)
      let movementsCreated = 0;
      for (const { item } of items) {
        await createMovement(tenantId, {
          materialId: item.materialId,
          type: 'in',
          quantity: Number(item.quantity),
          unitCostCents: item.unitPriceCents,
          purchaseOrderId: input.id,
          reason: `Recebimento OC ${po.code}`,
        }, userId);
        movementsCreated++;
      }

      logger.info({ tenantId, poId: input.id, movementsCreated }, 'inventory.po.received');
      return updated!;
    });
  }

  const extraFields = input.status === 'cancelled' ? { cancelledAt: new Date() } : {};
  const [updated] = await db.update(purchaseOrders)
    .set({ status: input.status, updatedAt: new Date(), ...extraFields })
    .where(and(eq(purchaseOrders.id, input.id), eq(purchaseOrders.tenantId, tenantId)))
    .returning();
  return updated!;
}

// ─── Import XML NF-e (09.09) ─────────────────────────────────────────────────

export async function importNfeXml(tenantId: number, xmlContent: string, userId: number) {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xmlContent);

  // Estrutura NF-e: nfeProc.NFe.infNFe
  const infNFe = parsed?.nfeProc?.NFe?.infNFe ?? parsed?.NFe?.infNFe ?? parsed?.infNFe;
  if (!infNFe) throw new TRPCError({ code: 'BAD_REQUEST', message: 'XML de NF-e inválido ou não reconhecido' });

  const emit = infNFe?.emit ?? {};
  const supplierCnpj = emit?.CNPJ ? String(emit.CNPJ) : undefined;
  const supplierName = emit?.xNome ? String(emit.xNome) : 'Fornecedor NF-e';

  // Try to find supplier by CNPJ
  let supplierId: number | undefined;
  if (supplierCnpj) {
    const [found] = await db.select({ id: suppliers.id }).from(suppliers)
      .where(and(eq(suppliers.tenantId, tenantId), eq(suppliers.cnpj, supplierCnpj)));
    supplierId = found?.id;
    // If not found, optionally create stub supplier
    if (!supplierId) {
      const [newSup] = await db.insert(suppliers).values({ tenantId, name: supplierName, cnpj: supplierCnpj }).returning();
      supplierId = newSup?.id;
    }
  }

  // Parse items: det can be array or single object
  const detRaw = infNFe?.det;
  const detItems: Array<{ prod?: { xProd?: string; qCom?: string; vUnCom?: string; cProd?: string; } }> =
    Array.isArray(detRaw) ? detRaw : detRaw ? [detRaw] : [];

  const poItems: CreatePurchaseOrderInput['items'] = [];
  for (const det of detItems) {
    const prod = det?.prod;
    if (!prod) continue;
    const name = String(prod.xProd ?? 'Item NF-e');
    const qty = Number(prod.qCom ?? 1);
    const unitPrice = Math.round(Number(prod.vUnCom ?? 0) * 100);
    const code = prod.cProd ? String(prod.cProd) : undefined;

    // Try to match material by code or name
    let materialId: number | undefined;
    if (code) {
      const [found] = await db.select({ id: materials.id }).from(materials)
        .where(and(eq(materials.tenantId, tenantId), eq(materials.code, code), isNull(materials.deletedAt)));
      materialId = found?.id;
    }
    if (!materialId) {
      const [found] = await db.select({ id: materials.id }).from(materials)
        .where(and(eq(materials.tenantId, tenantId), ilike(materials.name, `%${name}%`), isNull(materials.deletedAt)));
      materialId = found?.id;
    }
    if (!materialId) {
      // Create stub material
      const [newMat] = await db.insert(materials).values({
        tenantId, name, code, unit: 'un', averageCostCents: 0, createdBy: userId,
      }).returning();
      materialId = newMat!.id;
    }

    poItems.push({ materialId, quantity: qty, unitPriceCents: unitPrice });
  }

  if (poItems.length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nenhum item válido encontrado no XML' });

  const po = await createPurchaseOrder(tenantId, { supplierId, items: poItems, notes: 'Importado via XML NF-e' }, userId);
  logger.info({ tenantId, poId: po.id, itemsParsed: poItems.length }, 'inventory.nfe.import');
  return po;
}
