import type { ReportPreviewResult } from '@proteticflow/shared';
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { clients } from '../../db/schema/clients.js';
import { accountsPayable } from '../../db/schema/financials.js';
import { fiscalSettings } from '../../db/schema/fiscal.js';
import { jobs, jobItems } from '../../db/schema/jobs.js';
import { labSettings } from '../../db/schema/lab-settings.js';
import { suppliers } from '../../db/schema/materials.js';
import { tenants } from '../../db/schema/tenants.js';
import { formatAmountBrFromCents, formatCurrencyBrFromCents, generateFiscalCsv } from './csv-generator.js';
import { generateFiscalPdf } from './pdf-generator.js';
import type { FiscalExportInput, FiscalReportId, FiscalReportInput } from './fiscal.validators.js';

type FiscalMonthlyItem = {
  month: string;
  monthLabel: string;
  totalCents: number;
};

type FiscalBreakdownItem = {
  key: string;
  label: string;
  totalCents: number;
  percentage: number;
};

export type FiscalRevenueReport = {
  reportId: 'fiscal-revenue';
  period: {
    startDate: string;
    endDate: string;
  };
  totalCents: number;
  byMonth: FiscalMonthlyItem[];
  byClient: FiscalBreakdownItem[];
  byServiceType: FiscalBreakdownItem[];
};

export type FiscalExpensesReport = {
  reportId: 'fiscal-expenses';
  period: {
    startDate: string;
    endDate: string;
  };
  totalCents: number;
  byMonth: FiscalMonthlyItem[];
  bySupplier: FiscalBreakdownItem[];
  byCategory: FiscalBreakdownItem[];
};

export type FiscalDreByMonthItem = {
  month: string;
  monthLabel: string;
  grossRevenueCents: number;
  operatingExpensesCents: number;
  operatingResultCents: number;
  taxesCents: number;
  netResultCents: number;
};

export type FiscalDreReport = {
  reportId: 'fiscal-dre';
  period: {
    startDate: string;
    endDate: string;
  };
  taxRatePercent: number;
  grossRevenueCents: number;
  operatingExpensesCents: number;
  operatingResultCents: number;
  taxesCents: number;
  netResultCents: number;
  byMonth: FiscalDreByMonthItem[];
};

type FiscalArtifact = {
  filename: string;
  mimeType: string;
  base64: string;
};

type BrandingInfo = {
  labName: string;
  logoUrl: string | null;
};

type CsvSection = {
  title: string;
  headers: string[];
  rows: string[][];
};

type PdfSection = CsvSection;

const REVENUE_STATUSES: Array<'ready' | 'delivered'> = [
  'ready',
  'delivered',
];

function normalizeNumeric(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return `${month}/${year}`;
}

function toIsoPeriod(startDate: Date, endDate: Date): { startDate: string; endDate: string } {
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

function toBreakdown(
  rows: Array<{ key: string; label: string; totalCents: number }>,
  totalCents: number,
): FiscalBreakdownItem[] {
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    totalCents: row.totalCents,
    percentage:
      totalCents > 0 ? Number(((row.totalCents / totalCents) * 100).toFixed(2)) : 0,
  }));
}

function periodDates(input: FiscalReportInput): { startDate: Date; endDate: Date } {
  return {
    startDate: new Date(input.startDate),
    endDate: new Date(input.endDate),
  };
}

async function getBrandingInfo(tenantId: number): Promise<BrandingInfo> {
  const [settings] = await db
    .select({
      labName: labSettings.labName,
      logoUrl: labSettings.logoUrl,
    })
    .from(labSettings)
    .where(eq(labSettings.tenantId, tenantId))
    .limit(1);

  if (settings) {
    return {
      labName: settings.labName,
      logoUrl: settings.logoUrl ?? null,
    };
  }

  const [tenant] = await db
    .select({
      name: tenants.name,
      logoUrl: tenants.logoUrl,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return {
    labName: tenant?.name ?? 'ProteticFlow',
    logoUrl: tenant?.logoUrl ?? null,
  };
}

async function revenueByMonth(tenantId: number, startDate: Date, endDate: Date): Promise<FiscalMonthlyItem[]> {
  const rows = await db
    .select({
      monthKey: sql<string>`to_char(date_trunc('month', ${jobs.completedAt}), 'YYYY-MM')`,
      totalCents: sql<number>`COALESCE(SUM(${jobs.totalCents}), 0)::numeric`,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.tenantId, tenantId),
        isNull(jobs.deletedAt),
        inArray(jobs.status, REVENUE_STATUSES),
        isNotNull(jobs.completedAt),
        gte(jobs.completedAt, startDate),
        lte(jobs.completedAt, endDate),
      ),
    )
    .groupBy(sql`date_trunc('month', ${jobs.completedAt})`)
    .orderBy(sql`date_trunc('month', ${jobs.completedAt})`);

  return rows.map((row) => ({
    month: row.monthKey,
    monthLabel: monthLabel(row.monthKey),
    totalCents: Math.round(normalizeNumeric(row.totalCents)),
  }));
}

async function revenueByClient(
  tenantId: number,
  startDate: Date,
  endDate: Date,
): Promise<Array<{ key: string; label: string; totalCents: number }>> {
  const rows = await db
    .select({
      clientId: jobs.clientId,
      clientName: clients.name,
      totalCents: sql<number>`COALESCE(SUM(${jobs.totalCents}), 0)::numeric`,
    })
    .from(jobs)
    .innerJoin(clients, and(eq(clients.id, jobs.clientId), eq(clients.tenantId, tenantId), isNull(clients.deletedAt)))
    .where(
      and(
        eq(jobs.tenantId, tenantId),
        isNull(jobs.deletedAt),
        inArray(jobs.status, REVENUE_STATUSES),
        isNotNull(jobs.completedAt),
        gte(jobs.completedAt, startDate),
        lte(jobs.completedAt, endDate),
      ),
    )
    .groupBy(jobs.clientId, clients.name)
    .orderBy(desc(sql`COALESCE(SUM(${jobs.totalCents}), 0)`));

  return rows.map((row) => ({
    key: String(row.clientId),
    label: row.clientName ?? `Cliente #${row.clientId}`,
    totalCents: Math.round(normalizeNumeric(row.totalCents)),
  }));
}

async function revenueByServiceType(
  tenantId: number,
  startDate: Date,
  endDate: Date,
): Promise<Array<{ key: string; label: string; totalCents: number }>> {
  const rows = await db
    .select({
      serviceType: jobItems.serviceNameSnapshot,
      totalCents: sql<number>`COALESCE(SUM(${jobItems.totalCents}), 0)::numeric`,
    })
    .from(jobItems)
    .innerJoin(jobs, and(eq(jobs.id, jobItems.jobId), eq(jobs.tenantId, tenantId), isNull(jobs.deletedAt)))
    .where(
      and(
        eq(jobItems.tenantId, tenantId),
        inArray(jobs.status, REVENUE_STATUSES),
        isNotNull(jobs.completedAt),
        gte(jobs.completedAt, startDate),
        lte(jobs.completedAt, endDate),
      ),
    )
    .groupBy(jobItems.serviceNameSnapshot)
    .orderBy(desc(sql`COALESCE(SUM(${jobItems.totalCents}), 0)`));

  return rows.map((row) => ({
    key: row.serviceType,
    label: row.serviceType,
    totalCents: Math.round(normalizeNumeric(row.totalCents)),
  }));
}

async function expensesByMonth(tenantId: number, startDate: Date, endDate: Date): Promise<FiscalMonthlyItem[]> {
  const rows = await db
    .select({
      monthKey: sql<string>`to_char(date_trunc('month', ${accountsPayable.paidAt}), 'YYYY-MM')`,
      totalCents: sql<number>`COALESCE(SUM(${accountsPayable.amountCents}), 0)::numeric`,
    })
    .from(accountsPayable)
    .where(
      and(
        eq(accountsPayable.tenantId, tenantId),
        eq(accountsPayable.status, 'paid'),
        isNotNull(accountsPayable.paidAt),
        gte(accountsPayable.paidAt, startDate),
        lte(accountsPayable.paidAt, endDate),
      ),
    )
    .groupBy(sql`date_trunc('month', ${accountsPayable.paidAt})`)
    .orderBy(sql`date_trunc('month', ${accountsPayable.paidAt})`);

  return rows.map((row) => ({
    month: row.monthKey,
    monthLabel: monthLabel(row.monthKey),
    totalCents: Math.round(normalizeNumeric(row.totalCents)),
  }));
}

async function expensesBySupplier(
  tenantId: number,
  startDate: Date,
  endDate: Date,
): Promise<Array<{ key: string; label: string; totalCents: number }>> {
  const rows = await db
    .select({
      supplierId: accountsPayable.supplierId,
      supplierName: sql<string>`COALESCE(${suppliers.name}, NULLIF(${accountsPayable.supplier}, ''), 'Sem fornecedor')`,
      totalCents: sql<number>`COALESCE(SUM(${accountsPayable.amountCents}), 0)::numeric`,
    })
    .from(accountsPayable)
    .leftJoin(
      suppliers,
      and(
        eq(suppliers.id, accountsPayable.supplierId),
        eq(suppliers.tenantId, tenantId),
        isNull(suppliers.deletedAt),
      ),
    )
    .where(
      and(
        eq(accountsPayable.tenantId, tenantId),
        eq(accountsPayable.status, 'paid'),
        isNotNull(accountsPayable.paidAt),
        gte(accountsPayable.paidAt, startDate),
        lte(accountsPayable.paidAt, endDate),
      ),
    )
    .groupBy(accountsPayable.supplierId, suppliers.name, accountsPayable.supplier)
    .orderBy(desc(sql`COALESCE(SUM(${accountsPayable.amountCents}), 0)`));

  return rows.map((row) => ({
    key: row.supplierId ? String(row.supplierId) : row.supplierName.toLowerCase().replace(/\s+/g, '-'),
    label: row.supplierName,
    totalCents: Math.round(normalizeNumeric(row.totalCents)),
  }));
}

async function expensesByCategory(
  tenantId: number,
  startDate: Date,
  endDate: Date,
): Promise<Array<{ key: string; label: string; totalCents: number }>> {
  const rows = await db
    .select({
      categoryName: sql<string>`COALESCE(NULLIF(${accountsPayable.category}, ''), 'Sem categoria')`,
      totalCents: sql<number>`COALESCE(SUM(${accountsPayable.amountCents}), 0)::numeric`,
    })
    .from(accountsPayable)
    .where(
      and(
        eq(accountsPayable.tenantId, tenantId),
        eq(accountsPayable.status, 'paid'),
        isNotNull(accountsPayable.paidAt),
        gte(accountsPayable.paidAt, startDate),
        lte(accountsPayable.paidAt, endDate),
      ),
    )
    .groupBy(accountsPayable.category)
    .orderBy(desc(sql`COALESCE(SUM(${accountsPayable.amountCents}), 0)`));

  return rows.map((row) => ({
    key: row.categoryName.toLowerCase().replace(/\s+/g, '-'),
    label: row.categoryName,
    totalCents: Math.round(normalizeNumeric(row.totalCents)),
  }));
}

async function resolveTaxRatePercent(tenantId: number): Promise<number> {
  const [settings] = await db
    .select({
      issqnRatePercent: fiscalSettings.issqnRatePercent,
    })
    .from(fiscalSettings)
    .where(eq(fiscalSettings.tenantId, tenantId))
    .limit(1);

  return Number(normalizeNumeric(settings?.issqnRatePercent).toFixed(2));
}

function mergeDreByMonth(
  revenueByMonthRows: FiscalMonthlyItem[],
  expensesByMonthRows: FiscalMonthlyItem[],
  taxRatePercent: number,
): FiscalDreByMonthItem[] {
  const monthMap = new Map<string, { revenueCents: number; expensesCents: number }>();

  for (const row of revenueByMonthRows) {
    monthMap.set(row.month, {
      revenueCents: row.totalCents,
      expensesCents: monthMap.get(row.month)?.expensesCents ?? 0,
    });
  }

  for (const row of expensesByMonthRows) {
    monthMap.set(row.month, {
      revenueCents: monthMap.get(row.month)?.revenueCents ?? 0,
      expensesCents: row.totalCents,
    });
  }

  return Array.from(monthMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, values]) => {
      const operatingResultCents = values.revenueCents - values.expensesCents;
      const taxesCents = Math.round((operatingResultCents * taxRatePercent) / 100);
      const netResultCents = operatingResultCents - taxesCents;

      return {
        month,
        monthLabel: monthLabel(month),
        grossRevenueCents: values.revenueCents,
        operatingExpensesCents: values.expensesCents,
        operatingResultCents,
        taxesCents,
        netResultCents,
      };
    });
}

function revenueSummaryLines(report: FiscalRevenueReport): string[] {
  return [
    `Total faturado: ${formatCurrencyBrFromCents(report.totalCents)}`,
    `Dentistas no periodo: ${report.byClient.length}`,
    `Tipos de servico no periodo: ${report.byServiceType.length}`,
  ];
}

function expensesSummaryLines(report: FiscalExpensesReport): string[] {
  return [
    `Total de despesas pagas: ${formatCurrencyBrFromCents(report.totalCents)}`,
    `Fornecedores com despesas: ${report.bySupplier.length}`,
    `Categorias com despesas: ${report.byCategory.length}`,
  ];
}

function dreSummaryLines(report: FiscalDreReport): string[] {
  return [
    `Receita bruta: ${formatCurrencyBrFromCents(report.grossRevenueCents)}`,
    `Despesas operacionais: ${formatCurrencyBrFromCents(report.operatingExpensesCents)}`,
    `Resultado operacional: ${formatCurrencyBrFromCents(report.operatingResultCents)}`,
    `Taxa de imposto: ${report.taxRatePercent.toFixed(2)}%`,
    `Impostos: ${formatCurrencyBrFromCents(report.taxesCents)}`,
    `Resultado liquido: ${formatCurrencyBrFromCents(report.netResultCents)}`,
  ];
}

function revenueSections(report: FiscalRevenueReport): CsvSection[] {
  return [
    {
      title: 'Faturamento por mes',
      headers: ['Mes', 'Total (R$)'],
      rows: report.byMonth.map((item) => [item.monthLabel, formatAmountBrFromCents(item.totalCents)]),
    },
    {
      title: 'Faturamento por dentista',
      headers: ['Dentista', 'Total (R$)', 'Participacao (%)'],
      rows: report.byClient.map((item) => [
        item.label,
        formatAmountBrFromCents(item.totalCents),
        item.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ]),
    },
    {
      title: 'Faturamento por tipo de servico',
      headers: ['Tipo de servico', 'Total (R$)', 'Participacao (%)'],
      rows: report.byServiceType.map((item) => [
        item.label,
        formatAmountBrFromCents(item.totalCents),
        item.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ]),
    },
  ];
}

function expensesSections(report: FiscalExpensesReport): CsvSection[] {
  return [
    {
      title: 'Despesas por mes',
      headers: ['Mes', 'Total (R$)'],
      rows: report.byMonth.map((item) => [item.monthLabel, formatAmountBrFromCents(item.totalCents)]),
    },
    {
      title: 'Despesas por fornecedor',
      headers: ['Fornecedor', 'Total (R$)', 'Participacao (%)'],
      rows: report.bySupplier.map((item) => [
        item.label,
        formatAmountBrFromCents(item.totalCents),
        item.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ]),
    },
    {
      title: 'Despesas por categoria',
      headers: ['Categoria', 'Total (R$)', 'Participacao (%)'],
      rows: report.byCategory.map((item) => [
        item.label,
        formatAmountBrFromCents(item.totalCents),
        item.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ]),
    },
  ];
}

function dreSections(report: FiscalDreReport): CsvSection[] {
  return [
    {
      title: 'DRE mensal',
      headers: ['Mes', 'Receita (R$)', 'Despesas (R$)', 'Resultado operacional (R$)', 'Impostos (R$)', 'Resultado liquido (R$)'],
      rows: report.byMonth.map((item) => [
        item.monthLabel,
        formatAmountBrFromCents(item.grossRevenueCents),
        formatAmountBrFromCents(item.operatingExpensesCents),
        formatAmountBrFromCents(item.operatingResultCents),
        formatAmountBrFromCents(item.taxesCents),
        formatAmountBrFromCents(item.netResultCents),
      ]),
    },
  ];
}

function buildPreviewColumns(reportId: FiscalReportId): string[] {
  if (reportId === 'fiscal-revenue') {
    return ['group', 'label', 'totalCents', 'percentage'];
  }
  if (reportId === 'fiscal-expenses') {
    return ['group', 'label', 'totalCents', 'percentage'];
  }
  return ['month', 'grossRevenueCents', 'operatingExpensesCents', 'operatingResultCents', 'taxesCents', 'netResultCents'];
}

export async function getFiscalRevenueReport(
  tenantId: number,
  input: FiscalReportInput,
): Promise<FiscalRevenueReport> {
  const { startDate, endDate } = periodDates(input);

  const [monthlyRows, clientRows, serviceRows] = await Promise.all([
    revenueByMonth(tenantId, startDate, endDate),
    revenueByClient(tenantId, startDate, endDate),
    revenueByServiceType(tenantId, startDate, endDate),
  ]);

  const totalCents = monthlyRows.reduce((sum, item) => sum + item.totalCents, 0);

  return {
    reportId: 'fiscal-revenue',
    period: toIsoPeriod(startDate, endDate),
    totalCents,
    byMonth: monthlyRows,
    byClient: toBreakdown(clientRows, totalCents),
    byServiceType: toBreakdown(serviceRows, totalCents),
  };
}

export async function getFiscalExpensesReport(
  tenantId: number,
  input: FiscalReportInput,
): Promise<FiscalExpensesReport> {
  const { startDate, endDate } = periodDates(input);

  const [monthlyRows, supplierRows, categoryRows] = await Promise.all([
    expensesByMonth(tenantId, startDate, endDate),
    expensesBySupplier(tenantId, startDate, endDate),
    expensesByCategory(tenantId, startDate, endDate),
  ]);

  const totalCents = monthlyRows.reduce((sum, item) => sum + item.totalCents, 0);

  return {
    reportId: 'fiscal-expenses',
    period: toIsoPeriod(startDate, endDate),
    totalCents,
    byMonth: monthlyRows,
    bySupplier: toBreakdown(supplierRows, totalCents),
    byCategory: toBreakdown(categoryRows, totalCents),
  };
}

export async function getFiscalDreReport(
  tenantId: number,
  input: FiscalReportInput,
): Promise<FiscalDreReport> {
  const [revenue, expenses, taxRatePercent] = await Promise.all([
    getFiscalRevenueReport(tenantId, input),
    getFiscalExpensesReport(tenantId, input),
    resolveTaxRatePercent(tenantId),
  ]);

  const operatingResultCents = revenue.totalCents - expenses.totalCents;
  const taxesCents = Math.round((operatingResultCents * taxRatePercent) / 100);
  const netResultCents = operatingResultCents - taxesCents;
  const byMonth = mergeDreByMonth(revenue.byMonth, expenses.byMonth, taxRatePercent);

  return {
    reportId: 'fiscal-dre',
    period: revenue.period,
    taxRatePercent,
    grossRevenueCents: revenue.totalCents,
    operatingExpensesCents: expenses.totalCents,
    operatingResultCents,
    taxesCents,
    netResultCents,
    byMonth,
  };
}

async function resolveExportData(tenantId: number, input: FiscalExportInput): Promise<{
  title: string;
  sections: CsvSection[];
  summaryLines: string[];
}> {
  if (input.reportId === 'fiscal-revenue') {
    const report = await getFiscalRevenueReport(tenantId, input);
    return {
      title: 'Faturamento por Periodo',
      sections: revenueSections(report),
      summaryLines: revenueSummaryLines(report),
    };
  }
  if (input.reportId === 'fiscal-expenses') {
    const report = await getFiscalExpensesReport(tenantId, input);
    return {
      title: 'Despesas por Periodo',
      sections: expensesSections(report),
      summaryLines: expensesSummaryLines(report),
    };
  }

  const report = await getFiscalDreReport(tenantId, input);
  return {
    title: 'DRE Simplificado',
    sections: dreSections(report),
    summaryLines: dreSummaryLines(report),
  };
}

function reportFileName(reportId: FiscalReportId, startDate: string, endDate: string, extension: 'csv' | 'pdf'): string {
  const start = new Date(startDate).toISOString().slice(0, 10);
  const end = new Date(endDate).toISOString().slice(0, 10);
  return `${reportId}-${start}_${end}.${extension}`;
}

export async function exportFiscalCsv(tenantId: number, input: FiscalExportInput): Promise<FiscalArtifact> {
  const exportData = await resolveExportData(tenantId, input);
  const csv = generateFiscalCsv({
    reportTitle: exportData.title,
    periodStart: input.startDate,
    periodEnd: input.endDate,
    generatedAt: new Date().toISOString(),
    sections: exportData.sections,
  });

  return {
    filename: reportFileName(input.reportId, input.startDate, input.endDate, 'csv'),
    mimeType: 'text/csv; charset=utf-8',
    base64: Buffer.from(csv, 'utf-8').toString('base64'),
  };
}

export async function exportFiscalPdf(tenantId: number, input: FiscalExportInput): Promise<FiscalArtifact> {
  const [branding, exportData] = await Promise.all([
    getBrandingInfo(tenantId),
    resolveExportData(tenantId, input),
  ]);

  const pdfBuffer = await generateFiscalPdf({
    reportTitle: exportData.title,
    labName: branding.labName,
    logoUrl: branding.logoUrl,
    periodStart: input.startDate,
    periodEnd: input.endDate,
    generatedAt: new Date().toISOString(),
    summaryLines: exportData.summaryLines,
    sections: exportData.sections as PdfSection[],
  });

  return {
    filename: reportFileName(input.reportId, input.startDate, input.endDate, 'pdf'),
    mimeType: 'application/pdf',
    base64: pdfBuffer.toString('base64'),
  };
}

export async function buildFiscalPreview(
  tenantId: number,
  reportId: FiscalReportId,
  input: FiscalReportInput,
): Promise<ReportPreviewResult> {
  if (reportId === 'fiscal-revenue') {
    const report = await getFiscalRevenueReport(tenantId, input);
    return {
      type: 'fiscal-revenue',
      title: 'Faturamento por Periodo',
      generatedAt: new Date().toISOString(),
      summary: {
        totalCents: report.totalCents,
        totalClientes: report.byClient.length,
        totalServicos: report.byServiceType.length,
      },
      columns: buildPreviewColumns('fiscal-revenue'),
      rows: [
        ...report.byClient.map((item) => ({
          group: 'client',
          label: item.label,
          totalCents: item.totalCents,
          percentage: item.percentage,
        })),
        ...report.byServiceType.map((item) => ({
          group: 'serviceType',
          label: item.label,
          totalCents: item.totalCents,
          percentage: item.percentage,
        })),
      ],
    };
  }

  if (reportId === 'fiscal-expenses') {
    const report = await getFiscalExpensesReport(tenantId, input);
    return {
      type: 'fiscal-expenses',
      title: 'Despesas por Periodo',
      generatedAt: new Date().toISOString(),
      summary: {
        totalCents: report.totalCents,
        totalFornecedores: report.bySupplier.length,
        totalCategorias: report.byCategory.length,
      },
      columns: buildPreviewColumns('fiscal-expenses'),
      rows: [
        ...report.bySupplier.map((item) => ({
          group: 'supplier',
          label: item.label,
          totalCents: item.totalCents,
          percentage: item.percentage,
        })),
        ...report.byCategory.map((item) => ({
          group: 'category',
          label: item.label,
          totalCents: item.totalCents,
          percentage: item.percentage,
        })),
      ],
    };
  }

  const report = await getFiscalDreReport(tenantId, input);
  return {
    type: 'fiscal-dre',
    title: 'DRE Simplificado',
    generatedAt: new Date().toISOString(),
    summary: {
      grossRevenueCents: report.grossRevenueCents,
      operatingExpensesCents: report.operatingExpensesCents,
      operatingResultCents: report.operatingResultCents,
      taxRatePercent: report.taxRatePercent,
      taxesCents: report.taxesCents,
      netResultCents: report.netResultCents,
    },
    columns: buildPreviewColumns('fiscal-dre'),
    rows: report.byMonth.map((item) => ({
      month: item.monthLabel,
      grossRevenueCents: item.grossRevenueCents,
      operatingExpensesCents: item.operatingExpensesCents,
      operatingResultCents: item.operatingResultCents,
      taxesCents: item.taxesCents,
      netResultCents: item.netResultCents,
    })),
  };
}
