import { z } from 'zod';
import { router, tenantProcedure, adminProcedure, licensedProcedure } from '../../trpc/trpc.js';
import {
  createClientSchema,
  updateClientSchema,
  listClientsSchema,
  clientIdSchema,
} from '@proteticflow/shared';
import * as clientService from './service.js';

export const clientRouter = router({
  // ── licensedProcedure: garante que Fase 23 (limites de plano) funcione automaticamente ──
  create: licensedProcedure
    .input(createClientSchema)
    .mutation(async ({ input, ctx }) => {
      return clientService.createClient(ctx.tenantId!, input, ctx.user!.id);
    }),

  // ── Qualquer membro do tenant ──────────────────────────────────────────────
  list: tenantProcedure
    .input(listClientsSchema)
    .query(async ({ input, ctx }) => {
      return clientService.listClients(ctx.tenantId!, input);
    }),

  get: tenantProcedure
    .input(clientIdSchema)
    .query(async ({ input, ctx }) => {
      return clientService.getClient(ctx.tenantId!, input.id);
    }),

  update: tenantProcedure
    .input(clientIdSchema.merge(updateClientSchema))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return clientService.updateClient(ctx.tenantId!, id, data, ctx.user!.id);
    }),

  toggleStatus: tenantProcedure
    .input(clientIdSchema)
    .mutation(async ({ input, ctx }) => {
      return clientService.toggleClientStatus(ctx.tenantId!, input.id);
    }),

  getExtract: tenantProcedure
    .input(clientIdSchema)
    .query(async ({ input, ctx }) => {
      return clientService.getClientExtract(ctx.tenantId!, input.id);
    }),

  lookupCep: tenantProcedure
    .input(z.object({ cep: z.string().length(8) }))
    .query(async ({ input }) => {
      return clientService.lookupCep(input.cep);
    }),

  // ── Apenas admin (superadmin | gerente) ────────────────────────────────────
  delete: adminProcedure
    .input(clientIdSchema)
    .mutation(async ({ input, ctx }) => {
      await clientService.deleteClient(ctx.tenantId!, input.id, ctx.user!.id);
      return { success: true };
    }),
});
