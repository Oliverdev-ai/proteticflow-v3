import { router, tenantProcedure, adminProcedure } from '../../trpc/trpc.js';
import {
  reportPreviewSchema,
  reportGeneratePdfSchema,
  reportExportCsvSchema,
  reportSendByEmailSchema,
} from '@proteticflow/shared';
import * as reportsService from './service.js';

export const reportsRouter = router({
  listDefinitions: tenantProcedure.query(({ ctx }) => reportsService.listDefinitions(ctx.tenantId!)),

  preview: tenantProcedure
    .input(reportPreviewSchema)
    .query(({ ctx, input }) => reportsService.preview(ctx.tenantId!, input.type, input.filters, ctx.user!.role)),

  generatePdf: tenantProcedure
    .input(reportGeneratePdfSchema)
    .query(({ ctx, input }) =>
      reportsService.generatePdf(ctx.tenantId!, input.type, input.filters, ctx.user!.role, input.titleOverride),
    ),

  exportCsv: tenantProcedure
    .input(reportExportCsvSchema)
    .query(({ ctx, input }) => reportsService.exportCsv(ctx.tenantId!, input.type, input.filters, ctx.user!.role)),

  sendByEmail: adminProcedure
    .input(reportSendByEmailSchema)
    .mutation(({ ctx, input }) =>
      reportsService.sendByEmail(
        ctx.tenantId!,
        input.type,
        input.filters,
        ctx.user!.role,
        input.to,
        input.sendCsv,
        input.sendPdf,
      )),
});
