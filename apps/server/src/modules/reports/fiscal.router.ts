import { reportsProcedure } from '../../trpc/trpc.js';
import {
  exportFiscalCsv,
  exportFiscalPdf,
  getFiscalDreReport,
  getFiscalExpensesReport,
  getFiscalRevenueReport,
} from './fiscal.service.js';
import { fiscalExportInputSchema, fiscalReportInputSchema } from './fiscal.validators.js';

export const fiscalRevenueProcedure = reportsProcedure
  .input(fiscalReportInputSchema)
  .query(({ ctx, input }) => getFiscalRevenueReport(ctx.tenantId!, input));

export const fiscalExpensesProcedure = reportsProcedure
  .input(fiscalReportInputSchema)
  .query(({ ctx, input }) => getFiscalExpensesReport(ctx.tenantId!, input));

export const fiscalDreProcedure = reportsProcedure
  .input(fiscalReportInputSchema)
  .query(({ ctx, input }) => getFiscalDreReport(ctx.tenantId!, input));

export const fiscalExportCsvProcedure = reportsProcedure
  .input(fiscalExportInputSchema)
  .query(({ ctx, input }) => exportFiscalCsv(ctx.tenantId!, input));

export const fiscalExportPdfProcedure = reportsProcedure
  .input(fiscalExportInputSchema)
  .query(({ ctx, input }) => exportFiscalPdf(ctx.tenantId!, input));
