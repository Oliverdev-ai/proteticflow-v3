import { router, reportsAdminProcedure, reportsProcedure } from '../../trpc/trpc.js';
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
