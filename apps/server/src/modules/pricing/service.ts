import { eq, and, isNull, ilike, or, sql, count, isNotNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { pricingTables, priceItems, clients } from '../../db/schema/clients.js';
import { tenants } from '../../db/schema/tenants.js';
import { logger } from '../../logger.js';
import { TRPCError } from '@trpc/server';
import type {
  createPricingTableSchema,
  updatePricingTableSchema,
  createPriceItemSchema,
  updatePriceItemSchema,
  bulkAdjustSchema,
  listPriceItemsSchema,
  listPricingTablesSchema,
} from '@proteticflow/shared';
import type { z } from 'zod';

type CreatePricingTableInput = z.infer<typeof createPricingTableSchema>;
type UpdatePricingTableInput = z.infer<typeof updatePricingTableSchema>;
type CreatePriceItemInput = z.infer<typeof createPriceItemSchema>;
type UpdatePriceItemInput = z.infer<typeof updatePriceItemSchema>;
type BulkAdjustInput = z.infer<typeof bulkAdjustSchema>;
type ListPriceItemsInput = z.infer<typeof listPriceItemsSchema>;
type ListPricingTablesInput = z.infer<typeof listPricingTablesSchema>;

// ─── Pricing Tables ──────────────────────────────────────────────────────────

export async function createTable(tenantId: number, input: CreatePricingTableInput) {
  const [table] = await db.transaction(async (tx) => {
    // Se isDefault, desmarcar qualquer outra tabela padrão
    if (input.isDefault) {
      await tx.update(pricingTables)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(pricingTables.tenantId, tenantId), eq(pricingTables.isDefault, true)));
    }

    const [t] = await tx.insert(pricingTables).values({
      tenantId,
      name: input.name,
      description: input.description,
      isDefault: input.isDefault ?? false,
    }).returning();

    await tx.update(tenants)
      .set({ priceTableCount: sql`${tenants.priceTableCount} + 1` })
      .where(eq(tenants.id, tenantId));

    return [t];
  });

  logger.info({ action: 'pricing.table.create', tenantId, tableId: table.id }, 'Tabela de preços criada');
  return table;
}

export async function listTables(tenantId: number, filters: ListPricingTablesInput) {
  const offset = (filters.page - 1) * filters.limit;
  const conditions = [eq(pricingTables.tenantId, tenantId), isNull(pricingTables.deletedAt)];

  if (filters.search) {
    conditions.push(ilike(pricingTables.name, `%${filters.search}%`));
  }

  const whereClause = and(...conditions);
  const [data, totalResult] = await Promise.all([
    db.select().from(pricingTables).where(whereClause).limit(filters.limit).offset(offset),
    db.select({ count: count() }).from(pricingTables).where(whereClause),
  ]);

  return { data, total: totalResult[0]?.count ?? 0 };
}

export async function getTable(tenantId: number, tableId: number) {
  const [table] = await db.select().from(pricingTables).where(
    and(eq(pricingTables.tenantId, tenantId), eq(pricingTables.id, tableId), isNull(pricingTables.deletedAt))
  );
  if (!table) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tabela de preços não encontrada' });
  return table;
}

export async function updateTable(tenantId: number, tableId: number, input: UpdatePricingTableInput) {
  await getTable(tenantId, tableId);

  await db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx.update(pricingTables)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(pricingTables.tenantId, tenantId), eq(pricingTables.isDefault, true)));
    }

    await tx.update(pricingTables)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(pricingTables.tenantId, tenantId), eq(pricingTables.id, tableId)));
  });

  logger.info({ action: 'pricing.table.update', tenantId, tableId }, 'Tabela de preços atualizada');
  return getTable(tenantId, tableId);
}

export async function deleteTable(tenantId: number, tableId: number) {
  await getTable(tenantId, tableId);

  // Verificar clientes vinculados à tabela
  const [clientCount] = await db
    .select({ count: count() })
    .from(clients)
    .where(and(
      eq(clients.tenantId, tenantId),
      eq(clients.pricingTableId, tableId),
      isNull(clients.deletedAt),
    ));

  if ((clientCount?.count ?? 0) > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Não é possível excluir tabela que possui clientes vinculados.',
    });
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    // Soft delete dos itens da tabela
    await tx.update(priceItems)
      .set({ deletedAt: now })
      .where(and(eq(priceItems.pricingTableId, tableId), isNull(priceItems.deletedAt)));

    // Soft delete da tabela
    await tx.update(pricingTables)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(pricingTables.tenantId, tenantId), eq(pricingTables.id, tableId)));

    await tx.update(tenants)
      .set({ priceTableCount: sql`GREATEST(${tenants.priceTableCount} - 1, 0)` })
      .where(eq(tenants.id, tenantId));
  });
}

// ─── Price Items ─────────────────────────────────────────────────────────────

export async function createItem(tenantId: number, input: CreatePriceItemInput) {
  // Verificar que a tabela de preços pertence ao tenant
  await getTable(tenantId, input.pricingTableId);

  const [item] = await db.insert(priceItems).values({
    tenantId,
    pricingTableId: input.pricingTableId,
    name: input.name,
    code: input.code,
    description: input.description,
    category: input.category,
    material: input.material,
    estimatedDays: input.estimatedDays ?? 5,
    priceCents: input.priceCents,
  }).returning();

  logger.info({ action: 'pricing.item.create', tenantId, itemId: item.id }, 'Item de preço criado');
  return item;
}

export async function listItems(tenantId: number, filters: ListPriceItemsInput) {
  const offset = (filters.page - 1) * filters.limit;
  const conditions = [
    eq(priceItems.tenantId, tenantId),
    eq(priceItems.pricingTableId, filters.pricingTableId),
    isNull(priceItems.deletedAt),
  ];

  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(ilike(priceItems.name, term), ilike(priceItems.code, term))!);
  }

  const whereClause = and(...conditions);
  const [data, totalResult] = await Promise.all([
    db.select().from(priceItems).where(whereClause).limit(filters.limit).offset(offset),
    db.select({ count: count() }).from(priceItems).where(whereClause),
  ]);

  return { data, total: totalResult[0]?.count ?? 0 };
}

export async function updateItem(tenantId: number, itemId: number, input: UpdatePriceItemInput) {
  const [existing] = await db.select().from(priceItems).where(
    and(eq(priceItems.tenantId, tenantId), eq(priceItems.id, itemId), isNull(priceItems.deletedAt))
  );
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Item não encontrado' });

  const [updated] = await db.update(priceItems)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(priceItems.tenantId, tenantId), eq(priceItems.id, itemId)))
    .returning();

  return updated;
}

export async function deleteItem(tenantId: number, itemId: number) {
  const [existing] = await db.select().from(priceItems).where(
    and(eq(priceItems.tenantId, tenantId), eq(priceItems.id, itemId), isNull(priceItems.deletedAt))
  );
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Item não encontrado' });

  await db.update(priceItems)
    .set({ deletedAt: new Date() })
    .where(and(eq(priceItems.tenantId, tenantId), eq(priceItems.id, itemId)));
}

// ─── Bulk Operations ─────────────────────────────────────────────────────────

export async function bulkAdjust(tenantId: number, input: BulkAdjustInput) {
  // PAD-01: UPDATE atômico no banco — NUNCA read→calculate→write
  const percent = input.adjustmentPercent;
  const result = await db.update(priceItems)
    .set({
      priceCents: sql`ROUND(${priceItems.priceCents} * (1 + ${percent}::numeric / 100))`,
      updatedAt: new Date(),
    })
    .where(and(
      eq(priceItems.tenantId, tenantId),
      eq(priceItems.pricingTableId, input.pricingTableId),
      eq(priceItems.isActive, true),
      isNull(priceItems.deletedAt),
    ));

  const adjusted = result.rowCount ?? 0;
  logger.info({ action: 'pricing.bulk_adjust', tenantId, tableId: input.pricingTableId, percent, adjustedCount: adjusted }, 'Reajuste em lote aplicado');
  return { adjusted };
}

// ─── CSV Import/Export ────────────────────────────────────────────────────────

export async function exportCsv(tenantId: number, tableId: number): Promise<string> {
  await getTable(tenantId, tableId);

  const items = await db.select().from(priceItems).where(
    and(eq(priceItems.tenantId, tenantId), eq(priceItems.pricingTableId, tableId), eq(priceItems.isActive, true), isNull(priceItems.deletedAt))
  );

  const headers = ['name', 'code', 'description', 'category', 'material', 'priceCents', 'estimatedDays'];
  const rows = items.map(item => [
    item.name,
    item.code ?? '',
    item.description ?? '',
    item.category,
    item.material ?? '',
    String(item.priceCents),
    String(item.estimatedDays),
  ].map(v => `"${v.replace(/"/g, '""')}"`).join(','));

  return [headers.join(','), ...rows].join('\n');
}

export async function importCsv(tenantId: number, tableId: number, csvContent: string): Promise<{ created: number; updated: number; errors: { line: number; message: string }[] }> {
  await getTable(tenantId, tableId);

  const lines = csvContent.trim().split('\n');
  const header = lines[0]?.split(',').map(h => h.replace(/"/g, '').trim()) ?? [];

  const errors: { line: number; message: string }[] = [];
  let created = 0;
  let updated = 0;

  await db.transaction(async (tx) => {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line?.trim()) continue;

      try {
        const values = line.split(',').map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
        const row: Record<string, string> = {};
        header.forEach((h, idx) => { row[h] = values[idx] ?? ''; });

        const name = row['name'];
        if (!name) { errors.push({ line: i + 1, message: 'Nome obrigatório' }); continue; }

        const priceCents = parseInt(row['priceCents'] ?? '0', 10);
        if (isNaN(priceCents) || priceCents < 0) { errors.push({ line: i + 1, message: 'Preço inválido' }); continue; }

        // Upsert por nome na tabela
        const [existing] = await tx.select().from(priceItems).where(
          and(eq(priceItems.pricingTableId, tableId), eq(priceItems.name, name), isNull(priceItems.deletedAt))
        );

        if (existing) {
          await tx.update(priceItems)
            .set({
              code: row['code'] || undefined,
              description: row['description'] || undefined,
              category: row['category'] || existing.category,
              material: row['material'] || undefined,
              priceCents,
              estimatedDays: parseInt(row['estimatedDays'] ?? '5', 10) || 5,
              updatedAt: new Date(),
            })
            .where(eq(priceItems.id, existing.id));
          updated++;
        } else {
          await tx.insert(priceItems).values({
            tenantId,
            pricingTableId: tableId,
            name,
            code: row['code'] || undefined,
            description: row['description'] || undefined,
            category: row['category'] ?? 'Geral',
            material: row['material'] || undefined,
            priceCents,
            estimatedDays: parseInt(row['estimatedDays'] ?? '5', 10) || 5,
          });
          created++;
        }
      } catch (err) {
        errors.push({ line: i + 1, message: err instanceof Error ? err.message : 'Erro desconhecido' });
      }
    }
  });

  logger.info({ action: 'pricing.import_csv', tenantId, tableId, created, updated, errors: errors.length }, 'Import CSV concluído');
  return { created, updated, errors };
}
