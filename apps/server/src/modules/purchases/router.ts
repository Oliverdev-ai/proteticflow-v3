import { z } from 'zod';
import {
  cancelPurchaseSchema,
  createPurchaseSchema,
  listPurchasesSchema,
  receivePurchaseSchema,
  updatePurchaseSchema,
} from '@proteticflow/shared';
import { router, tenantProcedure } from '../../trpc/trpc.js';
import * as purchasesService from './service.js';

export const purchasesRouter = router({
  list: tenantProcedure
    .input(listPurchasesSchema)
    .query(({ ctx, input }) => purchasesService.listPurchases(ctx.user!.tenantId, input)),

  getById: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) => purchasesService.getPurchase(ctx.user!.tenantId, input.id)),

  create: tenantProcedure
    .input(createPurchaseSchema)
    .mutation(({ ctx, input }) => purchasesService.createPurchase(ctx.user!.tenantId, input, ctx.user!.id)),

  update: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(updatePurchaseSchema))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return purchasesService.updatePurchase(ctx.user!.tenantId, id, data);
    }),

  confirm: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => purchasesService.confirmPurchase(ctx.user!.tenantId, input.id, ctx.user!.id)),

  receive: tenantProcedure
    .input(receivePurchaseSchema)
    .mutation(({ ctx, input }) => {
      const dueDate = input.dueDate ? new Date(input.dueDate) : undefined;
      return purchasesService.receivePurchase(ctx.user!.tenantId, input.id, ctx.user!.id, dueDate);
    }),

  cancel: tenantProcedure
    .input(cancelPurchaseSchema)
    .mutation(({ ctx, input }) => purchasesService.cancelPurchase(ctx.user!.tenantId, input.id, ctx.user!.id)),

  listSuppliers: tenantProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(({ ctx, input }) => purchasesService.listSuppliersForPurchase(ctx.user!.tenantId, input.search)),

  listMaterials: tenantProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(({ ctx, input }) => purchasesService.listMaterialsForPurchase(ctx.user!.tenantId, input.search)),
});
