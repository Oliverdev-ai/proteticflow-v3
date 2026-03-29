import { and, eq, gte, lte } from 'drizzle-orm';
import type { ReportPreviewResult } from '@proteticflow/shared';
import { db } from '../../../db/index.js';
import { cashbookEntries } from '../../../db/schema/index.js';

type Filters = {
  dateFrom: string;
  dateTo: string;
  groupBy?: 'month' | 'quarter' | 'year' | 'week' | 'day';
};

function periodKey(date: Date, groupBy: Filters['groupBy']) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  if (groupBy === 'year') return `${year}`;
  if (groupBy === 'quarter') return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export async function buildQuarterlyAnnualReport(tenantId: number, filters: Filters): Promise<ReportPreviewResult> {
  const rows = await db
    .select({
      type: cashbookEntries.type,
      amountCents: cashbookEntries.amountCents,
      referenceDate: cashbookEntries.referenceDate,
      category: cashbookEntries.category,
    })
    .from(cashbookEntries)
    .where(and(
      eq(cashbookEntries.tenantId, tenantId),
      gte(cashbookEntries.referenceDate, new Date(filters.dateFrom)),
      lte(cashbookEntries.referenceDate, new Date(filters.dateTo)),
    ));

  const grouped = new Map<string, { credit: number; debit: number }>();
  for (const row of rows) {
    const key = periodKey(row.referenceDate, filters.groupBy);
    const current = grouped.get(key) ?? { credit: 0, debit: 0 };
    if (row.type === 'credit') current.credit += row.amountCents;
    if (row.type === 'debit') current.debit += row.amountCents;
    grouped.set(key, current);
  }

  const groupedRows = Array.from(grouped.entries()).map(([period, values]) => ({
    period,
    creditCents: values.credit,
    debitCents: values.debit,
    balanceCents: values.credit - values.debit,
  }));

  return {
    type: 'quarterly_annual',
    title: 'Consolidado Trimestral/Anual',
    generatedAt: new Date().toISOString(),
    summary: {
      periods: groupedRows.length,
      totalCreditCents: groupedRows.reduce((acc, row) => acc + row.creditCents, 0),
      totalDebitCents: groupedRows.reduce((acc, row) => acc + row.debitCents, 0),
    },
    columns: ['period', 'creditCents', 'debitCents', 'balanceCents'],
    rows: groupedRows,
  };
}
