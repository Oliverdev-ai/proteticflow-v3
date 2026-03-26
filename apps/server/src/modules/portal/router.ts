import { router, adminProcedure, publicProcedure, tenantProcedure } from '../../trpc/trpc.js';
import {
  createPortalTokenSchema,
  getPortalByTokenSchema,
  listPortalTokensByClientSchema,
  revokePortalTokenSchema,
  sendPortalLinkSchema,
} from '@proteticflow/shared';
import * as portalService from './service.js';

export const portalRouter = router({
  // Internas — restritas a superadmin/gerente
  createToken: adminProcedure
    .input(createPortalTokenSchema)
    .mutation(({ ctx, input }) => portalService.createPortalToken(ctx.tenantId!, input, ctx.user!.id)),

  listTokensByClient: tenantProcedure
    .input(listPortalTokensByClientSchema)
    .query(({ ctx, input }) => portalService.listPortalTokensByClient(ctx.tenantId!, input.clientId)),

  revokeToken: adminProcedure
    .input(revokePortalTokenSchema)
    .mutation(({ ctx, input }) => portalService.revokePortalToken(ctx.tenantId!, input.tokenId)),

  sendPortalLink: adminProcedure
    .input(sendPortalLinkSchema)
    .mutation(({ ctx, input }) => portalService.sendPortalLink(ctx.tenantId!, input.tokenId, input.email)),

  // Publica (sem login)
  getPortalByToken: publicProcedure
    .input(getPortalByTokenSchema)
    .query(({ input }) => portalService.getPortalSnapshotByToken(input.token)),
});
