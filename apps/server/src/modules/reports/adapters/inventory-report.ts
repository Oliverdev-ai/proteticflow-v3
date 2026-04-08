import { and, eq, gte, lte } from 'drizzle-orm';
import type { ReportPreviewResult } from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { materials, stockMovements, suppliers } from '../../../db/schema/index.js';

type Filters = {
  dateFrom: string;
  dateTo: string;
  supplierId?: number;
};

export async function buildInventoryReport(tenantId: number, filters: Filters): Promise<ReportPreviewResult> {
  const materialsRows = await db
    .select({
      materialId: materials.id,
      materialName: materials.name,
      supplierId: materials.supplierId,
      supplierName: suppliers.name,
      currentStock: materials.currentStock,
      minStock: materials.minStock,
      maxStock: materials.maxStock,
      isActive: materials.isActive,
    })
    .from(materials)
    .leftJoin(suppliers, eq(suppliers.id, materials.supplierId))
    .where(eq(materials.tenantId, tenantId));

  const movementConditions = [
    eq(stockMovements.tenantId, tenantId),
    gte(stockMovements.createdAt, new Date(filters.dateFrom)),
    lte(stockMovements.createdAt, new Date(filters.dateTo)),
  ];
  if (filters.supplierId) {
    movementConditions.push(eq(stockMovements.supplierId, filters.supplierId));
  }

  const movementRows = await db
    .select({
      materialId: stockMovements.materialId,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
    })
    .from(stockMovements)
    .where(and(...movementConditions));

  const movementsByMaterial = new Map<number, { inQty: number; outQty: number; adjustments: number }>();
  for (const row of movementRows) {
    const current = movementsByMaterial.get(row.materialId) ?? { inQty: 0, outQty: 0, adjustments: 0 };
    const qty = Number(row.quantity);
    if (row.type === 'in') current.inQty += qty;
    if (row.type === 'out') current.outQty += qty;
    if (row.type === 'adjustment') current.adjustments += qty;
    movementsByMaterial.set(row.materialId, current);
  }

  const rows = materialsRows.map((row) => {
    const movement = movementsByMaterial.get(row.materialId) ?? { inQty: 0, outQty: 0, adjustments: 0 };
    const currentStock = Number(row.currentStock);
    const minStock = Number(row.minStock);

    return {
      materialId: row.materialId,
      materialName: row.materialName,
      supplierId: row.supplierId ?? null,
      supplierName: row.supplierName ?? '-',
      currentStock,
      minStock,
      maxStock: row.maxStock ? Number(row.maxStock) : null,
      movedIn: Number(movement.inQty.toFixed(3)),
      movedOut: Number(movement.outQty.toFixed(3)),
      adjustments: Number(movement.adjustments.toFixed(3)),
      alertLowStock: currentStock <= minStock,
      isActive: row.isActive,
    };
  });

  return {
    type: 'inventory',
    title: 'Relatorio de Estoque',
    generatedAt: new Date().toISOString(),
    summary: {
      totalMaterials: rows.length,
      lowStockAlerts: rows.filter((row) => row.alertLowStock).length,
      movementCount: movementRows.length,
    },
    columns: [
      'materialId',
      'materialName',
      'supplierId',
      'supplierName',
      'currentStock',
      'minStock',
      'maxStock',
      'movedIn',
      'movedOut',
      'adjustments',
      'alertLowStock',
      'isActive',
    ],
    rows,
  };
}
