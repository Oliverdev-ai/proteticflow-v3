import { TRPCError } from '@trpc/server';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  stockAlertsSchema,
  stockCheckMaterialSchema,
  type StockAlertsInput,
  type StockCheckMaterialInput,
} from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { materials, stockMovements } from '../../../db/schema/materials.js';
import type { ToolContext } from '../tool-executor.js';
import { resolveMaterial } from '../resolvers.js';

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function executeStockCheckMaterial(
  ctx: ToolContext,
  input: StockCheckMaterialInput,
) {
  const parsed = stockCheckMaterialSchema.parse(input);
  let materialId = parsed.materialId;

  if (materialId === undefined && parsed.materialName) {
    const resolved = await resolveMaterial(ctx.tenantId, parsed.materialName);
    if (resolved.status === 'not_found') {
      return {
        status: 'not_found',
        searchTerm: resolved.searchTerm,
        suggestions: resolved.suggestions,
      };
    }
    if (resolved.status === 'ambiguous') {
      return {
        status: 'ambiguous',
        candidates: resolved.candidates,
      };
    }
    materialId = resolved.material.id;
  }

  if (!materialId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe materialId ou materialName' });
  }

  const [material] = await db
    .select({
      id: materials.id,
      name: materials.name,
      unit: materials.unit,
      currentStock: materials.currentStock,
      minStock: materials.minStock,
      maxStock: materials.maxStock,
      averageCostCents: materials.averageCostCents,
      lastPurchasePriceCents: materials.lastPurchasePriceCents,
    })
    .from(materials)
    .where(and(
      eq(materials.tenantId, ctx.tenantId),
      eq(materials.id, materialId),
      isNull(materials.deletedAt),
    ))
    .limit(1);

  if (!material) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Material nao encontrado' });
  }

  const [lastMovement] = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .where(and(
      eq(stockMovements.tenantId, ctx.tenantId),
      eq(stockMovements.materialId, material.id),
    ))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(1);

  const currentQty = toNumber(material.currentStock);
  const reorderLevel = toNumber(material.minStock);

  return {
    status: 'ok',
    material: {
      id: material.id,
      name: material.name,
      unit: material.unit,
      currentQty,
      reorderLevel,
      maxStock: material.maxStock ? toNumber(material.maxStock) : null,
      averageCostCents: material.averageCostCents,
      lastPurchasePriceCents: material.lastPurchasePriceCents,
      ...(lastMovement
        ? {
          lastMovement: {
            id: lastMovement.id,
            type: lastMovement.type,
            quantity: toNumber(lastMovement.quantity),
            createdAt: lastMovement.createdAt.toISOString(),
          },
        }
        : {}),
    },
    ...(parsed.unit && parsed.unit !== material.unit
      ? {
        note: `Unidade solicitada (${parsed.unit}) difere da unidade cadastrada (${material.unit}).`,
      }
      : {}),
  };
}

export async function executeStockAlerts(
  ctx: ToolContext,
  input: StockAlertsInput,
) {
  const parsed = stockAlertsSchema.parse(input);

  let thresholdCondition: ReturnType<typeof sql>;
  if (parsed.thresholdType === 'critical') {
    thresholdCondition = sql`${materials.currentStock} <= (${materials.minStock} / 2) AND ${materials.minStock} > 0`;
  } else {
    thresholdCondition = sql`${materials.currentStock} <= ${materials.minStock} AND ${materials.minStock} > 0`;
  }

  const rows = await db
    .select({
      id: materials.id,
      name: materials.name,
      code: materials.code,
      unit: materials.unit,
      currentStock: materials.currentStock,
      minStock: materials.minStock,
      maxStock: materials.maxStock,
    })
    .from(materials)
    .where(and(
      eq(materials.tenantId, ctx.tenantId),
      isNull(materials.deletedAt),
      eq(materials.isActive, true),
      thresholdCondition,
    ))
    .orderBy(materials.name);

  const alerts = rows
    .map((row) => {
      const currentQty = toNumber(row.currentStock);
      const minStock = toNumber(row.minStock);
      const shortage = Math.max(0, minStock - currentQty);
      const ratio = minStock > 0 ? currentQty / minStock : 1;
      return {
        id: row.id,
        name: row.name,
        code: row.code,
        unit: row.unit,
        currentQty,
        minStock,
        maxStock: row.maxStock ? toNumber(row.maxStock) : null,
        shortage,
        severity: ratio <= 0.5 ? 'critical' : 'warning',
      };
    })
    .sort((a, b) => b.shortage - a.shortage);

  if (alerts.length === 0) {
    return {
      status: 'ok',
      thresholdType: parsed.thresholdType,
      totalAlerts: 0,
      message: 'Todos os materiais estao acima do nivel de reposicao.',
      alerts: [],
    };
  }

  return {
    status: 'ok',
    thresholdType: parsed.thresholdType,
    totalAlerts: alerts.length,
    alerts,
  };
}
