import { TRPCError } from '@trpc/server';
import { and, count, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type {
  bulkAdjustSchema,
  createPriceItemSchema,
  createPricingTableSchema,
  listPriceItemsSchema,
  listPricingTablesSchema,
  updatePriceItemSchema,
  updatePricingTableSchema,
} from '@proteticflow/shared';
import type { z } from 'zod';

import { db } from '../../db/index.js';
import { pricingTables, priceItems, clients } from '../../db/schema/clients.js';
import { tenants } from '../../db/schema/tenants.js';
import { logger } from '../../logger.js';

type CreatePricingTableInput = z.infer<typeof createPricingTableSchema>;
type UpdatePricingTableInput = z.infer<typeof updatePricingTableSchema>;
type CreatePriceItemInput = z.infer<typeof createPriceItemSchema>;
type UpdatePriceItemInput = z.infer<typeof updatePriceItemSchema>;
type BulkAdjustInput = z.infer<typeof bulkAdjustSchema>;
type ListPriceItemsInput = z.infer<typeof listPriceItemsSchema>;
type ListPricingTablesInput = z.infer<typeof listPricingTablesSchema>;

export async function createTable(tenantId: number, input: CreatePricingTableInput) {
  const [table] = await db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx
        .update(pricingTables)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(pricingTables.tenantId, tenantId), eq(pricingTables.isDefault, true)));
    }

    const tableValues: typeof pricingTables.$inferInsert = {
      tenantId,
      name: input.name,
      isDefault: input.isDefault ?? false,
    };
    if (input.description !== undefined) {
      tableValues.description = input.description;
    }

    const [created] = await tx.insert(pricingTables).values(tableValues).returning();

    await tx
      .update(tenants)
      .set({ priceTableCount: sql`${tenants.priceTableCount} + 1` })
      .where(eq(tenants.id, tenantId));

    return [created];
  });

  if (!table) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar tabela de precos' });
  }

  logger.info({ action: 'pricing.table.create', tenantId, tableId: table.id }, 'Tabela de precos criada');
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
  const [table] = await db
    .select()
    .from(pricingTables)
    .where(
      and(
        eq(pricingTables.tenantId, tenantId),
        eq(pricingTables.id, tableId),
        isNull(pricingTables.deletedAt),
      ),
    );

  if (!table) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tabela de precos nao encontrada' });
  }

  return table;
}

export async function updateTable(tenantId: number, tableId: number, input: UpdatePricingTableInput) {
  await getTable(tenantId, tableId);

  await db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx
        .update(pricingTables)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(pricingTables.tenantId, tenantId), eq(pricingTables.isDefault, true)));
    }

    const tableUpdate: Partial<typeof pricingTables.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      tableUpdate.name = input.name;
    }
    if (input.description !== undefined) {
      tableUpdate.description = input.description;
    }
    if (input.isDefault !== undefined) {
      tableUpdate.isDefault = input.isDefault;
    }

    await tx
      .update(pricingTables)
      .set(tableUpdate)
      .where(and(eq(pricingTables.tenantId, tenantId), eq(pricingTables.id, tableId)));
  });

  logger.info({ action: 'pricing.table.update', tenantId, tableId }, 'Tabela de precos atualizada');
  return getTable(tenantId, tableId);
}

export async function deleteTable(tenantId: number, tableId: number) {
  await getTable(tenantId, tableId);

  const [clientCount] = await db
    .select({ count: count() })
    .from(clients)
    .where(
      and(
        eq(clients.tenantId, tenantId),
        eq(clients.pricingTableId, tableId),
        isNull(clients.deletedAt),
      ),
    );

  if ((clientCount?.count ?? 0) > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Nao e possivel excluir tabela que possui clientes vinculados.',
    });
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(priceItems)
      .set({ deletedAt: now })
      .where(and(eq(priceItems.pricingTableId, tableId), isNull(priceItems.deletedAt)));

    await tx
      .update(pricingTables)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(pricingTables.tenantId, tenantId), eq(pricingTables.id, tableId)));

    await tx
      .update(tenants)
      .set({ priceTableCount: sql`GREATEST(${tenants.priceTableCount} - 1, 0)` })
      .where(eq(tenants.id, tenantId));
  });
}

export async function createItem(tenantId: number, input: CreatePriceItemInput) {
  await getTable(tenantId, input.pricingTableId);

  const itemValues: typeof priceItems.$inferInsert = {
    tenantId,
    pricingTableId: input.pricingTableId,
    name: input.name,
    category: input.category,
    estimatedDays: input.estimatedDays ?? 5,
    priceCents: input.priceCents,
  };

  if (input.code !== undefined) {
    itemValues.code = input.code;
  }
  if (input.description !== undefined) {
    itemValues.description = input.description;
  }
  if (input.material !== undefined) {
    itemValues.material = input.material;
  }

  const [item] = await db.insert(priceItems).values(itemValues).returning();

  if (!item) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar item de preco' });
  }

  logger.info({ action: 'pricing.item.create', tenantId, itemId: item.id }, 'Item de preco criado');
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
  const [existing] = await db
    .select()
    .from(priceItems)
    .where(and(eq(priceItems.tenantId, tenantId), eq(priceItems.id, itemId), isNull(priceItems.deletedAt)));

  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Item nao encontrado' });
  }

  const itemUpdate: Partial<typeof priceItems.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.name !== undefined) {
    itemUpdate.name = input.name;
  }
  if (input.description !== undefined) {
    itemUpdate.description = input.description;
  }
  if (input.code !== undefined) {
    itemUpdate.code = input.code;
  }
  if (input.category !== undefined) {
    itemUpdate.category = input.category;
  }
  if (input.material !== undefined) {
    itemUpdate.material = input.material;
  }
  if (input.estimatedDays !== undefined) {
    itemUpdate.estimatedDays = input.estimatedDays;
  }
  if (input.priceCents !== undefined) {
    itemUpdate.priceCents = input.priceCents;
  }

  const [updated] = await db
    .update(priceItems)
    .set(itemUpdate)
    .where(and(eq(priceItems.tenantId, tenantId), eq(priceItems.id, itemId)))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Item nao encontrado' });
  }

  return updated;
}

export async function deleteItem(tenantId: number, itemId: number) {
  const [existing] = await db
    .select()
    .from(priceItems)
    .where(and(eq(priceItems.tenantId, tenantId), eq(priceItems.id, itemId), isNull(priceItems.deletedAt)));

  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Item nao encontrado' });
  }

  await db
    .update(priceItems)
    .set({ deletedAt: new Date() })
    .where(and(eq(priceItems.tenantId, tenantId), eq(priceItems.id, itemId)));
}

export async function bulkAdjust(tenantId: number, input: BulkAdjustInput) {
  const percent = input.adjustmentPercent;
  const result = await db
    .update(priceItems)
    .set({
      priceCents: sql`ROUND(${priceItems.priceCents} * (1 + ${percent}::numeric / 100))`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(priceItems.tenantId, tenantId),
        eq(priceItems.pricingTableId, input.pricingTableId),
        eq(priceItems.isActive, true),
        isNull(priceItems.deletedAt),
      ),
    );

  const adjusted = result.rowCount ?? 0;
  logger.info(
    { action: 'pricing.bulk_adjust', tenantId, tableId: input.pricingTableId, percent, adjustedCount: adjusted },
    'Reajuste em lote aplicado',
  );
  return { adjusted };
}

export async function exportCsv(tenantId: number, tableId: number): Promise<string> {
  await getTable(tenantId, tableId);

  const items = await db
    .select()
    .from(priceItems)
    .where(
      and(
        eq(priceItems.tenantId, tenantId),
        eq(priceItems.pricingTableId, tableId),
        eq(priceItems.isActive, true),
        isNull(priceItems.deletedAt),
      ),
    );

  const headers = ['name', 'code', 'description', 'category', 'material', 'priceCents', 'estimatedDays'];
  const rows = items.map((item) =>
    [
      item.name,
      item.code ?? '',
      item.description ?? '',
      item.category,
      item.material ?? '',
      String(item.priceCents),
      String(item.estimatedDays),
    ]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}

export async function importCsv(
  tenantId: number,
  tableId: number,
  csvContent: string,
): Promise<{ created: number; updated: number; errors: { line: number; message: string }[] }> {
  await getTable(tenantId, tableId);

  const lines = csvContent.trim().split('\n');
  const header = lines[0]?.split(',').map((h) => h.replace(/"/g, '').trim()) ?? [];

  const errors: { line: number; message: string }[] = [];
  let created = 0;
  let updated = 0;

  await db.transaction(async (tx) => {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line?.trim()) {
        continue;
      }

      try {
        const values = line
          .split(',')
          .map((v) => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
        const row: Record<string, string> = {};
        header.forEach((h, idx) => {
          row[h] = values[idx] ?? '';
        });

        const name = row['name'];
        if (!name) {
          errors.push({ line: i + 1, message: 'Nome obrigatorio' });
          continue;
        }

        const priceCents = parseInt(row['priceCents'] ?? '0', 10);
        if (Number.isNaN(priceCents) || priceCents < 0) {
          errors.push({ line: i + 1, message: 'Preco invalido' });
          continue;
        }

        const parsedEstimatedDays = parseInt(row['estimatedDays'] ?? '5', 10) || 5;
        const safeCode = row['code']?.trim() ? row['code'].trim() : null;
        const safeDescription = row['description']?.trim() ? row['description'].trim() : null;
        const safeMaterial = row['material']?.trim() ? row['material'].trim() : null;

        const [existing] = await tx
          .select()
          .from(priceItems)
          .where(and(eq(priceItems.pricingTableId, tableId), eq(priceItems.name, name), isNull(priceItems.deletedAt)));

        if (existing) {
          const safeCategory = row['category']?.trim() ? row['category'].trim() : existing.category;

          await tx
            .update(priceItems)
            .set({
              code: safeCode,
              description: safeDescription,
              category: safeCategory,
              material: safeMaterial,
              priceCents,
              estimatedDays: parsedEstimatedDays,
              updatedAt: new Date(),
            })
            .where(eq(priceItems.id, existing.id));

          updated++;
        } else {
          const safeCategory = row['category']?.trim() ? row['category'].trim() : 'Geral';

          await tx.insert(priceItems).values({
            tenantId,
            pricingTableId: tableId,
            name,
            code: safeCode,
            description: safeDescription,
            category: safeCategory,
            material: safeMaterial,
            priceCents,
            estimatedDays: parsedEstimatedDays,
          });

          created++;
        }
      } catch (err) {
        errors.push({
          line: i + 1,
          message: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }
  });

  logger.info(
    { action: 'pricing.import_csv', tenantId, tableId, created, updated, errors: errors.length },
    'Import CSV concluido',
  );

  return { created, updated, errors };
}
