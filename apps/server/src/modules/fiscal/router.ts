import { z } from 'zod';
import {
  cancelBoletoSchema,
  cancelNfseSchema,
  emitNfseInBatchSchema,
  emitNfseSchema,
  generateBoletoManualSchema,
  generateBoletoSchema,
  listBoletosSchema,
  listNfseSchema,
  upsertFiscalSettingsSchema,
} from '@proteticflow/shared';
import { adminProcedure, router, tenantProcedure } from '../../trpc/trpc.js';
import * as fiscalService from './service.js';

export const fiscalRouter = router({
  generateBoletoFromAr: tenantProcedure
    .input(generateBoletoSchema)
    .mutation(({ ctx, input }) =>
      fiscalService.generateBoletoFromAr(ctx.tenantId!, input, ctx.user!.id)),

  generateBoletoManual: adminProcedure
    .input(generateBoletoManualSchema)
    .mutation(({ ctx, input }) =>
      fiscalService.generateBoletoManual(ctx.tenantId!, ctx.user!.id, input)),

  listBoletos: tenantProcedure
    .input(listBoletosSchema)
    .query(({ ctx, input }) => fiscalService.listBoletos(ctx.tenantId!, input)),

  syncBoletoStatus: tenantProcedure
    .input(z.object({ boletoId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => fiscalService.syncBoletoStatus(ctx.tenantId!, input.boletoId)),

  cancelBoleto: adminProcedure
    .input(cancelBoletoSchema)
    .mutation(({ ctx, input }) => fiscalService.cancelBoleto(ctx.tenantId!, input, ctx.user!.id)),

  emitNfse: adminProcedure
    .input(emitNfseSchema)
    .mutation(({ ctx, input }) => fiscalService.emitNfse(ctx.tenantId!, ctx.user!.id, input)),

  emitNfseInBatch: adminProcedure
    .input(emitNfseInBatchSchema)
    .mutation(({ ctx, input }) => fiscalService.emitNfseInBatch(ctx.tenantId!, input, ctx.user!.id)),

  listNfse: tenantProcedure
    .input(listNfseSchema)
    .query(({ ctx, input }) => fiscalService.listNfse(ctx.tenantId!, input)),

  syncNfseStatus: tenantProcedure
    .input(z.object({ nfseId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => fiscalService.syncNfseStatus(ctx.tenantId!, input.nfseId)),

  cancelNfse: adminProcedure
    .input(cancelNfseSchema)
    .mutation(({ ctx, input }) => fiscalService.cancelNfse(ctx.tenantId!, input, ctx.user!.id)),

  getFiscalSettings: tenantProcedure
    .query(({ ctx }) => fiscalService.getFiscalSettings(ctx.tenantId!)),

  upsertFiscalSettings: adminProcedure
    .input(upsertFiscalSettingsSchema)
    .mutation(({ ctx, input }) => fiscalService.upsertFiscalSettings(ctx.tenantId!, ctx.user!.id, input)),
});
