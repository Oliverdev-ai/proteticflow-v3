import { reportsProcedure } from '../../trpc/trpc.js';
import {
  exportAbcCurveCsv,
  exportAbcCurvePdf,
  generateAbcCurveReport,
} from './abc-curve.service.js';
import { abcCurveInputSchema } from './abc-curve.validators.js';

export const abcCurveProcedure = reportsProcedure
  .input(abcCurveInputSchema)
  .query(({ ctx, input }) => generateAbcCurveReport(ctx.tenantId!, input));

export const abcCurveExportCsvProcedure = reportsProcedure
  .input(abcCurveInputSchema)
  .query(({ ctx, input }) => exportAbcCurveCsv(ctx.tenantId!, input));

export const abcCurveExportPdfProcedure = reportsProcedure
  .input(abcCurveInputSchema)
  .query(({ ctx, input }) => exportAbcCurvePdf(ctx.tenantId!, input));
