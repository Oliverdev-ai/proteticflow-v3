import { TRPCError } from '@trpc/server';
import type {
  ReportDefinition,
  ReportPreviewResult,
  ReportType,
  ReportEmailDispatchResult,
} from '@proteticflow/shared';
import { reportRegistry, getReportDefinition } from './report-registry.js';
import { generateReportPdf } from './pdf-engine.js';
import { buildJobsByPeriodReport } from './adapters/jobs-report.js';
import { buildProductivityReport } from './adapters/productivity-report.js';
import { buildDeliveriesReport } from './adapters/deliveries-report.js';

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

type UserRole = 'superadmin' | 'gerente' | 'contabil' | 'recepcao' | 'producao';

const REPORT_MIN_ROLE: Record<ReportType, UserRole> = {
  monthly_closing: 'contabil',
  jobs_by_period: 'recepcao',
  productivity: 'gerente',
  quarterly_annual: 'contabil',
  inventory: 'gerente',
  deliveries: 'recepcao',
  purchases: 'gerente',
  fiscal: 'contabil',
};

const ROLE_WEIGHT: Record<UserRole, number> = {
  producao: 1,
  recepcao: 2,
  contabil: 3,
  gerente: 4,
  superadmin: 5,
};

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

function assertReportEnabledOrThrow(definition: ReportDefinition | null) {
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

  const pdfBuffer = generateReportPdf({
    report,
    labName: 'Laboratorio',
    includeCharts: filters.includeCharts ?? true,
  });

  return {
    filename: `${type}.pdf`,
    mimeType: 'application/pdf',
    base64: pdfBuffer.toString('base64'),
  };
}

function toCsv(previewResult: ReportPreviewResult) {
  const header = previewResult.columns.join(',');
  const rows = previewResult.rows.map((row) => (
    previewResult.columns
      .map((column) => {
        const value = row[column];
        const normalized = value === null || value === undefined ? '' : String(value);
        return `"${normalized.replace(/"/g, '""')}"`;
      })
      .join(',')
  ));

  return [header, ...rows].join('\n');
}

export async function exportCsv(tenantId: number, type: ReportType, filters: ReportFilters, userRole: string) {
  const previewResult = await preview(tenantId, type, filters, userRole);
  const csv = toCsv(previewResult);
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
  if (sendPdf && definition.supportsPdf) {
    attachments.push(`${type}.pdf`);
    await generatePdf(tenantId, type, filters, userRole);
  }
  if (sendCsv && definition.supportsCsv) {
    attachments.push(`${type}.csv`);
    await exportCsv(tenantId, type, filters, userRole);
  }

  return {
    success: true,
    to,
    reportType: type,
    attachments,
  };
}
