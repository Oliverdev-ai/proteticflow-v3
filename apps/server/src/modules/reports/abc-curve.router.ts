import { tenantProcedure } from '../../trpc/trpc.js';
import {
  exportAbcCurveCsv,
  exportAbcCurvePdf,
  generateAbcCurveReport,
} from './abc-curve.service.js';
import { abcCurveInputSchema } from './abc-curve.validators.js';

export const abcCurveProcedure = tenantProcedure
  .input(abcCurveInputSchema)
  .query(({ ctx, input }) => generateAbcCurveReport(ctx.tenantId!, input));

export const abcCurveExportCsvProcedure = tenantProcedure
  .input(abcCurveInputSchema)
  .query(({ ctx, input }) => exportAbcCurveCsv(ctx.tenantId!, input));

export const abcCurveExportPdfProcedure = tenantProcedure
  .input(abcCurveInputSchema)
  .query(({ ctx, input }) => exportAbcCurvePdf(ctx.tenantId!, input));

