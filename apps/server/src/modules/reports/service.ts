import { TRPCError } from '@trpc/server';
import type {
  ReportDefinition,
  ReportPreviewResult,
  ReportType,
  ReportEmailDispatchResult,
} from '@proteticflow/shared';
import { and, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { labSettings } from '../../db/schema/lab-settings.js';
import {
  accountsPayable,
  accountsReceivable,
  cashbookEntries,
  clients,
  jobs,
  materials,
} from '../../db/schema/index.js';
import { reportRegistry, getReportDefinition } from './report-registry.js';
import { generateReportPdf } from './pdf-engine.js';
import { buildJobsByPeriodReport } from './adapters/jobs-report.js';
import { buildProductivityReport } from './adapters/productivity-report.js';
import { buildDeliveriesReport } from './adapters/deliveries-report.js';
import { buildMonthlyClosingReport } from './adapters/monthly-closing-report.js';
import { buildQuarterlyAnnualReport } from './adapters/quarterly-annual-report.js';
import { buildInventoryReport } from './adapters/inventory-report.js';
import { buildPurchasesReport } from './adapters/purchases-report.js';
import { serializeReportCsv } from './csv.js';
import { sendReportByEmail } from './email.js';
import { buildFiscalPreview } from './fiscal.service.js';

type ReportFilters = {
  dateFrom: string;
  dateTo: string;
  clientId?: number;
  employeeId?: number;
  supplierId?: number;
  status?: string;
  groupBy?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  includeCharts?: boolean;
  includeBreakdownByClient?: boolean;
};

export type ReportsDashboardType = 'production' | 'financial' | 'clients' | 'inventory';

export type ReportsDashboardFilters = {
  dateFrom: string;
  dateTo: string;
};

export type ClientRankingFilters = ReportsDashboardFilters & {
  page: number;
  pageSize: number;
};

type InventoryDashboardStatus = 'critical' | 'low' | 'ok';

type UserRole = 'superadmin' | 'gerente' | 'contabil' | 'recepcao' | 'producao';

const REPORT_MIN_ROLE: Record<ReportType, UserRole> = {
  monthly_closing: 'contabil',
  jobs_by_period: 'recepcao',
  productivity: 'gerente',
  quarterly_annual: 'contabil',
  inventory: 'gerente',
  deliveries: 'recepcao',
  purchases: 'gerente',
  'fiscal-revenue': 'contabil',
  'fiscal-expenses': 'contabil',
  'fiscal-dre': 'contabil',
};

const ROLE_WEIGHT: Record<UserRole, number> = {
  producao: 1,
  recepcao: 2,
  contabil: 3,
  gerente: 4,
  superadmin: 5,
};

const JOB_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em producao',
  quality_check: 'Qualidade',
  ready: 'Pronto',
  rework_in_progress: 'Retrabalho',
  suspended: 'Suspenso',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

function parseRange(filters: ReportsDashboardFilters) {
  return {
    dateFrom: new Date(filters.dateFrom),
    dateTo: new Date(filters.dateTo),
  };
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvLine(values: unknown[]) {
  return `${values.map(csvEscape).join(',')}\n`;
}

function assertRoleAccess(userRole: string, reportType: ReportType) {
  const role = (userRole as UserRole);
  const minRole = REPORT_MIN_ROLE[reportType];
  const currentWeight = ROLE_WEIGHT[role] ?? 0;
  const minWeight = ROLE_WEIGHT[minRole];

  if (currentWeight < minWeight) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Perfil sem permissao para o relatorio ${reportType}`,
    });
  }
}

function assertReportEnabledOrThrow(definition: ReportDefinition | null): asserts definition is ReportDefinition {
  if (!definition) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Relatorio nao encontrado' });
  }

  if (!definition.enabled) {
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: definition.dependencyNote ?? 'Relatorio indisponivel nesta fase',
    });
  }
}

function buildPlaceholderPreview(type: ReportType): ReportPreviewResult {
  return {
    type,
    title: getReportDefinition(type)?.title ?? type,
    generatedAt: new Date().toISOString(),
    summary: {
      note: 'Adapter deste relatorio sera resolvido nos blocos especificos da fase',
    },
    columns: ['info'],
    rows: [{ info: 'Sem dados no placeholder inicial' }],
  };
}

async function resolvePreview(
  tenantId: number,
  type: ReportType,
  filters: ReportFilters,
): Promise<ReportPreviewResult> {
  if (type === 'jobs_by_period') {
    return buildJobsByPeriodReport(tenantId, filters);
  }
  if (type === 'productivity') {
    return buildProductivityReport(tenantId, filters);
  }
  if (type === 'deliveries') {
    return buildDeliveriesReport(tenantId, filters);
  }
  if (type === 'monthly_closing') {
    return buildMonthlyClosingReport(tenantId, filters);
  }
  if (type === 'quarterly_annual') {
    return buildQuarterlyAnnualReport(tenantId, filters);
  }
  if (type === 'inventory') {
    return buildInventoryReport(tenantId, filters);
  }
  if (type === 'purchases') {
    return buildPurchasesReport(tenantId, filters);
  }
  if (type === 'fiscal-revenue' || type === 'fiscal-expenses' || type === 'fiscal-dre') {
    return buildFiscalPreview(tenantId, type, {
      startDate: filters.dateFrom,
      endDate: filters.dateTo,
    });
  }

  return buildPlaceholderPreview(type);
}

export async function listDefinitions(_tenantId: number) {
  return reportRegistry;
}

export async function preview(tenantId: number, type: ReportType, _filters: ReportFilters, userRole: string) {
  void tenantId;
  assertRoleAccess(userRole, type);
  const definition = getReportDefinition(type);
  assertReportEnabledOrThrow(definition);
  return resolvePreview(tenantId, type, _filters);
}

export async function generatePdf(
  tenantId: number,
  type: ReportType,
  filters: ReportFilters,
  userRole: string,
  titleOverride?: string,
) {
  const previewResult = await preview(tenantId, type, filters, userRole);
  const report = titleOverride
    ? { ...previewResult, title: titleOverride }
    : previewResult;

  const [settings] = await db
    .select({ labName: labSettings.labName, logoUrl: labSettings.logoUrl })
    .from(labSettings)
    .where(eq(labSettings.tenantId, tenantId));

  const pdfBuffer = await generateReportPdf({
    report,
    labName: settings?.labName ?? 'Laboratório',
    logoUrl: settings?.logoUrl ?? null,
    includeCharts: filters.includeCharts ?? true,
  });

  return {
    filename: `${type}.pdf`,
    mimeType: 'application/pdf',
    base64: pdfBuffer.toString('base64'),
  };
}

export async function exportCsv(tenantId: number, type: ReportType, filters: ReportFilters, userRole: string) {
  const previewResult = await preview(tenantId, type, filters, userRole);
  const csv = serializeReportCsv(previewResult);
  return {
    filename: `${type}.csv`,
    mimeType: 'text/csv',
    base64: Buffer.from(csv, 'utf-8').toString('base64'),
  };
}

export async function sendByEmail(
  tenantId: number,
  type: ReportType,
  filters: ReportFilters,
  userRole: string,
  to: string,
  sendCsv: boolean,
  sendPdf: boolean,
): Promise<ReportEmailDispatchResult> {
  const definition = getReportDefinition(type);
  assertReportEnabledOrThrow(definition);
  assertRoleAccess(userRole, type);

  const attachments: string[] = [];
  const payloadAttachments: Array<{ filename: string; mimeType: string; base64: string }> = [];
  if (sendPdf && definition.supportsPdf) {
    const pdf = await generatePdf(tenantId, type, filters, userRole);
    attachments.push(pdf.filename);
    payloadAttachments.push(pdf);
  }
  if (sendCsv && definition.supportsCsv) {
    const csv = await exportCsv(tenantId, type, filters, userRole);
    attachments.push(csv.filename);
    payloadAttachments.push(csv);
  }

  const emailResult = await sendReportByEmail({
    tenantId,
    reportType: type,
    to,
    attachments: payloadAttachments,
  });

  return {
    success: emailResult.success,
    to,
    reportType: type,
    attachments,
  };
}

export async function getProductionDashboard(tenantId: number, filters: ReportsDashboardFilters) {
  const { dateFrom, dateTo } = parseRange(filters);
  const now = new Date();

  const rows = await db
    .select({
      id: jobs.id,
      status: jobs.status,
      deadline: jobs.deadline,
      deliveredAt: jobs.deliveredAt,
      totalCents: jobs.totalCents,
    })
    .from(jobs)
    .where(and(
      eq(jobs.tenantId, tenantId),
      isNull(jobs.deletedAt),
      gte(jobs.createdAt, dateFrom),
      lte(jobs.createdAt, dateTo),
    ));

  const buckets = new Map<string, { status: string; label: string; value: number; totalCents: number }>();
  for (const status of Object.keys(JOB_STATUS_LABELS)) {
    buckets.set(status, {
      status,
      label: JOB_STATUS_LABELS[status] ?? status,
      value: 0,
      totalCents: 0,
    });
  }

  let deliveredJobs = 0;
  let overdueJobs = 0;
  let totalRevenueCents = 0;

  for (const row of rows) {
    const bucket = buckets.get(row.status) ?? {
      status: row.status,
      label: JOB_STATUS_LABELS[row.status] ?? row.status,
      value: 0,
      totalCents: 0,
    };
    bucket.value += 1;
    bucket.totalCents += row.totalCents;
    buckets.set(row.status, bucket);
    totalRevenueCents += row.totalCents;

    if (row.status === 'delivered') deliveredJobs += 1;
    if (!['delivered', 'cancelled'].includes(row.status) && row.deadline < now) overdueJobs += 1;
  }

  return {
    summary: {
      totalJobs: rows.length,
      deliveredJobs,
      overdueJobs,
      totalRevenueCents,
    },
    statusBuckets: Array.from(buckets.values()).filter((bucket) => bucket.value > 0),
  };
}

export async function getFinancialDashboard(tenantId: number, filters: ReportsDashboardFilters) {
  const { dateFrom, dateTo } = parseRange(filters);

  const entries = await db
    .select({
      type: cashbookEntries.type,
      amountCents: cashbookEntries.amountCents,
      referenceDate: cashbookEntries.referenceDate,
    })
    .from(cashbookEntries)
    .where(and(
      eq(cashbookEntries.tenantId, tenantId),
      gte(cashbookEntries.referenceDate, dateFrom),
      lte(cashbookEntries.referenceDate, dateTo),
    ));

  const months = new Map<string, { label: string; value: number; comparison: number; netCents: number }>();
  let totalCreditsCents = 0;
  let totalDebitsCents = 0;

  for (const entry of entries) {
    const key = monthKey(entry.referenceDate);
    const current = months.get(key) ?? { label: key, value: 0, comparison: 0, netCents: 0 };
    if (entry.type === 'credit') {
      current.value += entry.amountCents;
      totalCreditsCents += entry.amountCents;
    } else {
      current.comparison += entry.amountCents;
      totalDebitsCents += entry.amountCents;
    }
    current.netCents = current.value - current.comparison;
    months.set(key, current);
  }

  const [pendingCreditsRow] = await db
    .select({ total: sql<number>`sum(${accountsReceivable.amountCents})` })
    .from(accountsReceivable)
    .where(and(
      eq(accountsReceivable.tenantId, tenantId),
      inArray(accountsReceivable.status, ['pending', 'overdue']),
      lte(accountsReceivable.dueDate, dateTo),
    ));

  const [pendingDebitsRow] = await db
    .select({ total: sql<number>`sum(${accountsPayable.amountCents})` })
    .from(accountsPayable)
    .where(and(
      eq(accountsPayable.tenantId, tenantId),
      inArray(accountsPayable.status, ['pending', 'overdue']),
      lte(accountsPayable.dueDate, dateTo),
    ));

  const paidRows = await db
    .select({
      clientId: accountsReceivable.clientId,
      clientName: clients.name,
      amountCents: accountsReceivable.amountCents,
    })
    .from(accountsReceivable)
    .leftJoin(clients, and(
      eq(accountsReceivable.clientId, clients.id),
      eq(clients.tenantId, tenantId),
    ))
    .where(and(
      eq(accountsReceivable.tenantId, tenantId),
      eq(accountsReceivable.status, 'paid'),
      gte(accountsReceivable.paidAt, dateFrom),
      lte(accountsReceivable.paidAt, dateTo),
    ));

  const topClientsMap = new Map<number, { clientId: number; clientName: string; totalPaidCents: number; count: number }>();
  for (const row of paidRows) {
    const current = topClientsMap.get(row.clientId) ?? {
      clientId: row.clientId,
      clientName: row.clientName ?? 'Sem nome',
      totalPaidCents: 0,
      count: 0,
    };
    current.totalPaidCents += row.amountCents;
    current.count += 1;
    topClientsMap.set(row.clientId, current);
  }

  return {
    summary: {
      totalCreditsCents,
      totalDebitsCents,
      netCents: totalCreditsCents - totalDebitsCents,
      pendingCreditsCents: Number(pendingCreditsRow?.total ?? 0),
      pendingDebitsCents: Number(pendingDebitsRow?.total ?? 0),
    },
    cashFlow: Array.from(months.values()).sort((a, b) => a.label.localeCompare(b.label)),
    topClients: Array.from(topClientsMap.values())
      .sort((a, b) => b.totalPaidCents - a.totalPaidCents)
      .slice(0, 10),
  };
}

export async function getClientRankingDashboard(tenantId: number, filters: ClientRankingFilters) {
  const { dateFrom, dateTo } = parseRange(filters);

  const clientRows = await db
    .select({
      id: clients.id,
      name: clients.name,
      clinic: clients.clinic,
      status: clients.status,
      totalJobs: clients.totalJobs,
      totalRevenueCents: clients.totalRevenueCents,
    })
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), isNull(clients.deletedAt)))
    .orderBy(desc(clients.totalRevenueCents));

  const arRows = await db
    .select({
      clientId: accountsReceivable.clientId,
      status: accountsReceivable.status,
      amountCents: accountsReceivable.amountCents,
      dueDate: accountsReceivable.dueDate,
      paidAt: accountsReceivable.paidAt,
    })
    .from(accountsReceivable)
    .where(and(
      eq(accountsReceivable.tenantId, tenantId),
      gte(accountsReceivable.dueDate, dateFrom),
      lte(accountsReceivable.dueDate, dateTo),
    ));

  const arByClient = new Map<number, {
    paidCents: number;
    pendingCents: number;
    totalCents: number;
    invoices: number;
    onTime: number;
  }>();
  for (const row of arRows) {
    const current = arByClient.get(row.clientId) ?? {
      paidCents: 0,
      pendingCents: 0,
      totalCents: 0,
      invoices: 0,
      onTime: 0,
    };
    if (row.status !== 'cancelled') {
      current.totalCents += row.amountCents;
      current.invoices += 1;
    }
    if (row.status === 'paid') {
      current.paidCents += row.amountCents;
      if (row.paidAt && row.paidAt <= row.dueDate) current.onTime += 1;
    }
    if (row.status === 'pending' || row.status === 'overdue') {
      current.pendingCents += row.amountCents;
    }
    arByClient.set(row.clientId, current);
  }

  const ranking = clientRows
    .map((client) => {
      const stats = arByClient.get(client.id) ?? {
        paidCents: 0,
        pendingCents: 0,
        totalCents: 0,
        invoices: 0,
        onTime: 0,
      };
      return {
        clientId: client.id,
        clientName: client.name,
        clinic: client.clinic,
        status: client.status,
        totalJobs: client.totalJobs,
        totalRevenueCents: client.totalRevenueCents,
        paidCents: stats.paidCents,
        pendingCents: stats.pendingCents,
        periodTotalCents: stats.totalCents,
        onTimePercent: stats.invoices > 0 ? Number(((stats.onTime / stats.invoices) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.periodTotalCents - a.periodTotalCents || b.totalRevenueCents - a.totalRevenueCents);

  const start = (filters.page - 1) * filters.pageSize;
  return {
    data: ranking.slice(start, start + filters.pageSize),
    total: ranking.length,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getInventoryDashboard(tenantId: number, _filters: ReportsDashboardFilters) {
  const rows = await db
    .select({
      materialId: materials.id,
      materialName: materials.name,
      code: materials.code,
      unit: materials.unit,
      currentStock: materials.currentStock,
      minStock: materials.minStock,
      maxStock: materials.maxStock,
      averageCostCents: materials.averageCostCents,
      isActive: materials.isActive,
    })
    .from(materials)
    .where(and(eq(materials.tenantId, tenantId), isNull(materials.deletedAt)))
    .orderBy(materials.name);

  const data = rows.map((row) => {
    const currentStock = Number(row.currentStock);
    const minStock = Number(row.minStock);
    const maxStock = row.maxStock ? Number(row.maxStock) : null;
    const status: InventoryDashboardStatus = currentStock <= 0 || (minStock > 0 && currentStock <= minStock / 2)
      ? 'critical'
      : currentStock <= minStock
        ? 'low'
        : 'ok';

    return {
      materialId: row.materialId,
      materialName: row.materialName,
      code: row.code,
      unit: row.unit,
      currentStock,
      minStock,
      maxStock,
      averageCostCents: row.averageCostCents,
      status,
      isActive: row.isActive,
    };
  });

  return {
    summary: {
      totalMaterials: data.length,
      criticalCount: data.filter((row) => row.status === 'critical').length,
      lowCount: data.filter((row) => row.status === 'low').length,
      okCount: data.filter((row) => row.status === 'ok').length,
    },
    materials: data,
  };
}

export async function* streamDashboardCsv(
  tenantId: number,
  type: ReportsDashboardType,
  filters: ReportsDashboardFilters,
): AsyncGenerator<string> {
  if (type === 'production') {
    const report = await getProductionDashboard(tenantId, filters);
    yield csvLine(['status', 'trabalhos', 'valor_total_centavos']);
    for (const row of report.statusBuckets) {
      yield csvLine([row.label, row.value, row.totalCents]);
    }
    return;
  }

  if (type === 'financial') {
    const report = await getFinancialDashboard(tenantId, filters);
    yield csvLine(['mes', 'receitas_centavos', 'despesas_centavos', 'resultado_centavos']);
    for (const row of report.cashFlow) {
      yield csvLine([row.label, row.value, row.comparison, row.netCents]);
    }
    yield '\n';
    yield csvLine(['top_cliente_id', 'cliente', 'recebido_centavos', 'titulos_pagos']);
    for (const row of report.topClients) {
      yield csvLine([row.clientId, row.clientName, row.totalPaidCents, row.count]);
    }
    return;
  }

  if (type === 'clients') {
    const report = await getClientRankingDashboard(tenantId, { ...filters, page: 1, pageSize: 10_000 });
    yield csvLine(['cliente_id', 'cliente', 'clinica', 'jobs', 'receita_periodo_centavos', 'recebido_centavos', 'pendente_centavos', 'pontualidade_percentual']);
    for (const row of report.data) {
      yield csvLine([
        row.clientId,
        row.clientName,
        row.clinic ?? '',
        row.totalJobs,
        row.periodTotalCents,
        row.paidCents,
        row.pendingCents,
        row.onTimePercent,
      ]);
    }
    return;
  }

  const report = await getInventoryDashboard(tenantId, filters);
  yield csvLine(['material_id', 'material', 'codigo', 'estoque_atual', 'estoque_minimo', 'estoque_maximo', 'unidade', 'status']);
  for (const row of report.materials) {
    yield csvLine([
      row.materialId,
      row.materialName,
      row.code ?? '',
      row.currentStock,
      row.minStock,
      row.maxStock ?? '',
      row.unit,
      row.status,
    ]);
  }
}
