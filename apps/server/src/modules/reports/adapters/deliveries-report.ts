import { and, eq, gte, lte } from 'drizzle-orm';
import type { ReportPreviewResult } from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { deliveryItems, deliverySchedules, clients } from '../../../db/schema/index.js';

type Filters = {
  dateFrom: string;
  dateTo: string;
  clientId?: number;
};

function hoursBetween(start: Date, end: Date | null) {
  if (!end) return null;
  return Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 100) / 100;
}

export async function buildDeliveriesReport(tenantId: number, filters: Filters): Promise<ReportPreviewResult> {
  const conditions = [
    eq(deliveryItems.tenantId, tenantId),
    eq(deliverySchedules.tenantId, tenantId),
    gte(deliverySchedules.date, new Date(filters.dateFrom)),
    lte(deliverySchedules.date, new Date(filters.dateTo)),
  ];

  if (filters.clientId) {
    conditions.push(eq(deliveryItems.clientId, filters.clientId));
  }

  const rows = await db
    .select({
      itemId: deliveryItems.id,
      scheduleDate: deliverySchedules.date,
      driverName: deliverySchedules.driverName,
      status: deliveryItems.status,
      deliveredAt: deliveryItems.deliveredAt,
      failedReason: deliveryItems.failedReason,
      clientName: clients.name,
    })
    .from(deliveryItems)
    .innerJoin(deliverySchedules, eq(deliverySchedules.id, deliveryItems.scheduleId))
    .leftJoin(clients, eq(clients.id, deliveryItems.clientId))
    .where(and(...conditions));

  const averageHoursList = rows
    .map((row) => hoursBetween(row.scheduleDate, row.deliveredAt))
    .filter((value): value is number => typeof value === 'number');

  const averageHours = averageHoursList.length === 0
    ? 0
    : Number((averageHoursList.reduce((acc, value) => acc + value, 0) / averageHoursList.length).toFixed(2));

  return {
    type: 'deliveries',
    title: 'Relatorio de Entregas',
    generatedAt: new Date().toISOString(),
    summary: {
      totalItems: rows.length,
      delivered: rows.filter((row) => row.status === 'delivered').length,
      failed: rows.filter((row) => row.status === 'failed').length,
      averageHours,
    },
    columns: ['itemId', 'scheduleDate', 'driverName', 'clientName', 'status', 'deliveredAt', 'failedReason'],
    rows: rows.map((row) => ({
      itemId: row.itemId,
      scheduleDate: row.scheduleDate.toISOString(),
      driverName: row.driverName ?? '-',
      clientName: row.clientName ?? '-',
      status: row.status,
      deliveredAt: row.deliveredAt ? row.deliveredAt.toISOString() : null,
      failedReason: row.failedReason ?? null,
    })),
  };
}
