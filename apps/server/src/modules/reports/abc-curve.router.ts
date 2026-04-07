import { tenantProcedure } from '../../trpc/trpc.js';
import { generateAbcCurveReport } from './abc-curve.service.js';
import { abcCurveInputSchema } from './abc-curve.validators.js';

export const abcCurveProcedure = tenantProcedure
  .input(abcCurveInputSchema)
  .query(({ ctx, input }) => generateAbcCurveReport(ctx.tenantId!, input));

