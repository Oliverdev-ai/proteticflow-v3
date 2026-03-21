import { router, tenantProcedure, licensedProcedure, adminProcedure } from '../../trpc/trpc.js';
import { z } from 'zod';
import {
  createArSchema,
  listArSchema,
  markArPaidSchema,
  cancelArSchema,
  createApSchema,
  listApSchema,
  markApPaidSchema,
  cancelApSchema
} from '@proteticflow/shared';

import * as service from './service.js';

export const financialRouter = router({
  // ─── Contas a Receber ────────────────────────────────────────────────────────
  createAr: licensedProcedure.input(createArSchema).mutation(({ input, ctx }) => {
    return service.createAr(ctx.tenant.id, input);
  }),

  listAr: tenantProcedure.input(listArSchema).query(({ input, ctx }) => {
    return service.listAr(ctx.tenant.id, input);
  }),

  getAr: tenantProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input, ctx }) => {
    return service.getAr(ctx.tenant.id, input.id);
  }),

  markArPaid: tenantProcedure.input(markArPaidSchema).mutation(({ input, ctx }) => {
    return service.markArPaid(ctx.tenant.id, input, ctx.user.id);
  }),

  cancelAr: adminProcedure.input(cancelArSchema).mutation(({ input, ctx }) => {
    return service.cancelAr(ctx.tenant.id, input, ctx.user.id);
  }),

  // ─── Contas a Pagar ──────────────────────────────────────────────────────────
  createAp: licensedProcedure.input(createApSchema).mutation(({ input, ctx }) => {
    return service.createAp(ctx.tenant.id, input, ctx.user.id);
  }),

  listAp: tenantProcedure.input(listApSchema).query(({ input, ctx }) => {
    return service.listAp(ctx.tenant.id, input);
  }),

  getAp: tenantProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input, ctx }) => {
    return service.getAp(ctx.tenant.id, input.id);
  }),

  markApPaid: tenantProcedure.input(markApPaidSchema).mutation(({ input, ctx }) => {
    return service.markApPaid(ctx.tenant.id, input, ctx.user.id);
  }),

  cancelAp: adminProcedure.input(cancelApSchema).mutation(({ input, ctx }) => {
    return service.cancelAp(ctx.tenant.id, input, ctx.user.id);
  }),
});
