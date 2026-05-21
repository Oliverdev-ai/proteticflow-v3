import { router, reportsAdminProcedure, reportsProcedure } from '../../trpc/trpc.js';
import { z } from 'zod';
import {
  reportPreviewSchema,
  reportGeneratePdfSchema,
  reportExportCsvSchema,
  reportSendByEmailSchema,
} from '@proteticflow/shared';
import * as reportsService from './service.js';
import {
  abcCurveExportCsvProcedure,
  abcCurveExportPdfProcedure,
  abcCurveProcedure,
} from './abc-curve.router.js';
import {
  fiscalDreProcedure,
  fiscalExpensesProcedure,
  fiscalExportCsvProcedure,
  fiscalExportPdfProcedure,
  fiscalRevenueProcedure,
} from './fiscal.router.js';

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

const reportDashboardFiltersSchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
});

const clientRankingFiltersSchema = reportDashboardFiltersSchema.extend({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(10),
});

function sanitizeFilters(filters: {
  dateFrom: string;
  dateTo: string;
  clientId?: number | undefined;
  employeeId?: number | undefined;
  supplierId?: number | undefined;
  status?: string | undefined;
  groupBy?: 'day' | 'week' | 'month' | 'quarter' | 'year' | undefined;
  includeCharts?: boolean | undefined;
  includeBreakdownByClient?: boolean | undefined;
}): ReportFilters {
  return {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    ...(filters.clientId !== undefined ? { clientId: filters.clientId } : {}),
    ...(filters.employeeId !== undefined ? { employeeId: filters.employeeId } : {}),
    ...(filters.supplierId !== undefined ? { supplierId: filters.supplierId } : {}),
    ...(filters.status !== undefined ? { status: filters.status } : {}),
    ...(filters.groupBy !== undefined ? { groupBy: filters.groupBy } : {}),
    ...(filters.includeCharts !== undefined ? { includeCharts: filters.includeCharts } : {}),
    ...(filters.includeBreakdownByClient !== undefined
      ? { includeBreakdownByClient: filters.includeBreakdownByClient }
      : {}),
  };
}

export const reportsRouter = router({
  abcCurve: abcCurveProcedure,
  abcCurveExportCsv: abcCurveExportCsvProcedure,
  abcCurveExportPdf: abcCurveExportPdfProcedure,
  fiscalRevenue: fiscalRevenueProcedure,
  fiscalExpenses: fiscalExpensesProcedure,
  fiscalDRE: fiscalDreProcedure,
  exportCSV: fiscalExportCsvProcedure,
  exportPDF: fiscalExportPdfProcedure,

  listDefinitions: reportsProcedure.query(({ ctx }) => reportsService.listDefinitions(ctx.tenantId!)),

  preview: reportsProcedure
    .input(reportPreviewSchema)
    .query(({ ctx, input }) =>
      reportsService.preview(ctx.tenantId!, input.type, sanitizeFilters(input.filters), ctx.user!.role),
    ),

  generatePdf: reportsProcedure
    .input(reportGeneratePdfSchema)
    .query(({ ctx, input }) =>
      reportsService.generatePdf(
        ctx.tenantId!,
        input.type,
        sanitizeFilters(input.filters),
        ctx.user!.role,
        input.titleOverride,
      ),
    ),

  exportCsv: reportsProcedure
    .input(reportExportCsvSchema)
    .query(({ ctx, input }) =>
      reportsService.exportCsv(ctx.tenantId!, input.type, sanitizeFilters(input.filters), ctx.user!.role),
    ),

  productionDashboard: reportsProcedure
    .input(reportDashboardFiltersSchema)
    .query(({ ctx, input }) => reportsService.getProductionDashboard(ctx.tenantId!, input)),

  financialDashboard: reportsProcedure
    .input(reportDashboardFiltersSchema)
    .query(({ ctx, input }) => reportsService.getFinancialDashboard(ctx.tenantId!, input)),

  clientRanking: reportsProcedure
    .input(clientRankingFiltersSchema)
    .query(({ ctx, input }) => reportsService.getClientRankingDashboard(ctx.tenantId!, input)),

  inventoryDashboard: reportsProcedure
    .input(reportDashboardFiltersSchema)
    .query(({ ctx, input }) => reportsService.getInventoryDashboard(ctx.tenantId!, input)),

  sendByEmail: reportsAdminProcedure
    .input(reportSendByEmailSchema)
    .mutation(({ ctx, input }) =>
      reportsService.sendByEmail(
        ctx.tenantId!,
        input.type,
        sanitizeFilters(input.filters),
        ctx.user!.role,
        input.to,
        input.sendCsv,
        input.sendPdf,
      )),
});
