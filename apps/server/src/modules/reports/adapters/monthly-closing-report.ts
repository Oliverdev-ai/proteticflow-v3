import { and, eq, gte, lte } from 'drizzle-orm';
import type { ReportPreviewResult } from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { accountsReceivable, clients } from '../../../db/schema/index.js';

type Filters = {
  dateFrom: string;
  dateTo: string;
  clientId?: number;
  includeBreakdownByClient?: boolean;
};

export async function buildMonthlyClosingReport(tenantId: number, filters: Filters): Promise<ReportPreviewResult> {
  const conditions = [
    eq(accountsReceivable.tenantId, tenantId),
    gte(accountsReceivable.dueDate, new Date(filters.dateFrom)),
    lte(accountsReceivable.dueDate, new Date(filters.dateTo)),
  ];

  if (filters.clientId) {
    conditions.push(eq(accountsReceivable.clientId, filters.clientId));
  }

  const rows = await db
    .select({
      arId: accountsReceivable.id,
      clientId: accountsReceivable.clientId,
      clientName: clients.name,
      status: accountsReceivable.status,
      amountCents: accountsReceivable.amountCents,
      dueDate: accountsReceivable.dueDate,
      paidAt: accountsReceivable.paidAt,
    })
    .from(accountsReceivable)
    .leftJoin(clients, eq(clients.id, accountsReceivable.clientId))
    .where(and(...conditions));

  const totalCents = rows.reduce((acc, row) => acc + row.amountCents, 0);
  const paidCents = rows
    .filter((row) => row.status === 'paid')
    .reduce((acc, row) => acc + row.amountCents, 0);
  const pendingCents = rows
    .filter((row) => row.status === 'pending' || row.status === 'overdue')
    .reduce((acc, row) => acc + row.amountCents, 0);

  const breakdownByClient = new Map<number, { clientId: number; clientName: string; totalCents: number }>();
  if (filters.includeBreakdownByClient ?? true) {
    for (const row of rows) {
      const current = breakdownByClient.get(row.clientId) ?? {
        clientId: row.clientId,
        clientName: row.clientName ?? '-',
        totalCents: 0,
      };
      current.totalCents += row.amountCents;
      breakdownByClient.set(row.clientId, current);
    }
  }

  return {
    type: 'monthly_closing',
    title: 'Fechamento Mensal',
    generatedAt: new Date().toISOString(),
    summary: {
      totalTitulos: rows.length,
      totalCents,
      paidCents,
      pendingCents,
      breakdownClients: breakdownByClient.size,
    },
    columns: ['arId', 'clientId', 'clientName', 'status', 'amountCents', 'dueDate', 'paidAt'],
    rows: [
      ...rows.map((row) => ({
        arId: row.arId,
        clientId: row.clientId,
        clientName: row.clientName ?? '-',
        status: row.status,
        amountCents: row.amountCents,
        dueDate: row.dueDate.toISOString(),
        paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      })),
      ...Array.from(breakdownByClient.values()).map((row) => ({
        arId: 'breakdown',
        clientId: row.clientId,
        clientName: row.clientName,
        status: 'breakdown',
        amountCents: row.totalCents,
        dueDate: null,
        paidAt: null,
      })),
    ],
  };
}
