import { and, eq, gte, lte } from 'drizzle-orm';
import type { ReportPreviewResult } from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { purchaseOrders, suppliers } from '../../../db/schema/index.js';

type Filters = {
  dateFrom: string;
  dateTo: string;
  supplierId?: number;
};

export async function buildPurchasesReport(tenantId: number, filters: Filters): Promise<ReportPreviewResult> {
  const conditions = [
    eq(purchaseOrders.tenantId, tenantId),
    gte(purchaseOrders.createdAt, new Date(filters.dateFrom)),
    lte(purchaseOrders.createdAt, new Date(filters.dateTo)),
  ];
  if (filters.supplierId) {
    conditions.push(eq(purchaseOrders.supplierId, filters.supplierId));
  }

  const rows = await db
    .select({
      purchaseOrderId: purchaseOrders.id,
      code: purchaseOrders.code,
      supplierId: purchaseOrders.supplierId,
      supplierName: suppliers.name,
      status: purchaseOrders.status,
      totalCents: purchaseOrders.totalCents,
      createdAt: purchaseOrders.createdAt,
      receivedAt: purchaseOrders.receivedAt,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .where(and(...conditions));

  const totalsBySupplier = new Map<number, { supplierName: string; totalCents: number }>();
  for (const row of rows) {
    if (!row.supplierId) continue;
    const current = totalsBySupplier.get(row.supplierId) ?? {
      supplierName: row.supplierName ?? '-',
      totalCents: 0,
    };
    current.totalCents += row.totalCents;
    totalsBySupplier.set(row.supplierId, current);
  }

  return {
    type: 'purchases',
    title: 'Relatorio de Compras',
    generatedAt: new Date().toISOString(),
    summary: {
      totalOrders: rows.length,
      totalCents: rows.reduce((acc, row) => acc + row.totalCents, 0),
      suppliers: totalsBySupplier.size,
    },
    columns: ['purchaseOrderId', 'code', 'supplierId', 'supplierName', 'status', 'totalCents', 'createdAt', 'receivedAt'],
    rows: rows.map((row) => ({
      purchaseOrderId: row.purchaseOrderId,
      code: row.code,
      supplierId: row.supplierId ?? null,
      supplierName: row.supplierName ?? '-',
      status: row.status,
      totalCents: row.totalCents,
      createdAt: row.createdAt.toISOString(),
      receivedAt: row.receivedAt ? row.receivedAt.toISOString() : null,
    })),
  };
}
