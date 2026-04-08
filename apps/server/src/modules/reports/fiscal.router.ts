import { tenantProcedure } from '../../trpc/trpc.js';
import {
  exportFiscalCsv,
  exportFiscalPdf,
  getFiscalDreReport,
  getFiscalExpensesReport,
  getFiscalRevenueReport,
} from './fiscal.service.js';
import { fiscalExportInputSchema, fiscalReportInputSchema } from './fiscal.validators.js';

export const fiscalRevenueProcedure = tenantProcedure
  .input(fiscalReportInputSchema)
  .query(({ ctx, input }) => getFiscalRevenueReport(ctx.tenantId!, input));

export const fiscalExpensesProcedure = tenantProcedure
  .input(fiscalReportInputSchema)
  .query(({ ctx, input }) => getFiscalExpensesReport(ctx.tenantId!, input));

export const fiscalDreProcedure = tenantProcedure
  .input(fiscalReportInputSchema)
  .query(({ ctx, input }) => getFiscalDreReport(ctx.tenantId!, input));

export const fiscalExportCsvProcedure = tenantProcedure
  .input(fiscalExportInputSchema)
  .query(({ ctx, input }) => exportFiscalCsv(ctx.tenantId!, input));

export const fiscalExportPdfProcedure = tenantProcedure
  .input(fiscalExportInputSchema)
  .query(({ ctx, input }) => exportFiscalPdf(ctx.tenantId!, input));
