import { z } from 'zod';
import { router, adminProcedure, licensedProcedure, tenantProcedure } from '../../trpc/trpc.js';
import {
  changePrintStatusSchema,
  createScanSchema,
  listScansSchema,
  updateScanSchema,
} from '@proteticflow/shared';
import * as scanService from './service.js';

export const scanRouter = router({
  create: licensedProcedure
    .input(createScanSchema)
    .mutation(({ ctx, input }) => scanService.createScan(ctx.tenantId!, input, ctx.user!.id)),

  list: tenantProcedure
    .input(listScansSchema)
    .query(({ ctx, input }) => scanService.listScans(ctx.tenantId!, input)),

  get: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) => scanService.getScan(ctx.tenantId!, input.id)),

  update: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(updateScanSchema))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return scanService.updateScan(ctx.tenantId!, id, data);
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await scanService.deleteScan(ctx.tenantId!, input.id, ctx.user!.id);
      return { success: true };
    }),

  uploadFile: tenantProcedure
    .input(z.object({
      scanId: z.number().int().positive(),
      fileType: z.enum(['stl_upper', 'stl_lower', 'xml', 'gallery']),
      base64Content: z.string().min(1),
      filename: z.string().min(1),
    }))
    .mutation(({ ctx, input }) => {
      const buffer = Buffer.from(input.base64Content, 'base64');
      return scanService.uploadScanFile(
        ctx.tenantId!,
        input.scanId,
        input.fileType,
        buffer,
        input.filename,
        ctx.user!.id,
      );
    }),

  changePrintStatus: tenantProcedure
    .input(changePrintStatusSchema)
    .mutation(({ ctx, input }) => scanService.changePrintStatus(ctx.tenantId!, input, ctx.user!.id)),

  sendToPrinter: adminProcedure
    .input(z.object({ scanId: z.number().int().positive(), printerIp: z.string().min(1).max(45) }))
    .mutation(async ({ ctx, input }) => {
      await scanService.sendToPrinter(ctx.tenantId!, input.scanId, input.printerIp, ctx.user!.id);
      return { success: true };
    }),
});

