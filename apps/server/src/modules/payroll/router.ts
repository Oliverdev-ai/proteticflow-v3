import { z } from 'zod';
import { router, tenantProcedure, adminProcedure } from '../../trpc/trpc.js';
import * as payrollService from './service.js';
import { updatePayrollEntrySchema } from '@proteticflow/shared';

export const payrollRouter = router({
  createPeriod: adminProcedure.input(z.object({ year: z.number(), month: z.number() })).mutation(({ ctx, input }) =>
    payrollService.createPeriod(ctx.user!.tenantId, input.year, input.month)),

  listPeriods: tenantProcedure.query(({ ctx }) =>
    payrollService.listPeriods(ctx.user!.tenantId)),

  generateEntries: adminProcedure.input(z.object({ periodId: z.number() })).mutation(({ ctx, input }) =>
    payrollService.generateEntries(ctx.user!.tenantId, input.periodId, ctx.user!.id)),

  updateEntry: adminProcedure.input(updatePayrollEntrySchema).mutation(({ ctx, input }) =>
    payrollService.updateEntry(ctx.user!.tenantId, input, ctx.user!.id)),

  closePeriod: adminProcedure.input(z.object({ periodId: z.number() })).mutation(({ ctx, input }) =>
    payrollService.closePeriod(ctx.user!.tenantId, input.periodId, ctx.user!.id)),

  reopenPeriod: adminProcedure.input(z.object({ periodId: z.number() })).mutation(({ ctx, input }) =>
    payrollService.reopenPeriod(ctx.user!.tenantId, input.periodId, ctx.user!.id)),

  getPeriodReport: tenantProcedure.input(z.object({ periodId: z.number() })).query(({ ctx, input }) =>
    payrollService.getPeriodReport(ctx.user!.tenantId, input.periodId)),

  generatePayslip: tenantProcedure.input(z.object({ periodId: z.number(), employeeId: z.number() })).query(({ ctx, input }) =>
    payrollService.generatePayslipPdf(ctx.user!.tenantId, input.periodId, input.employeeId)),
});
