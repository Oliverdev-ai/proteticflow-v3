import { z } from 'zod';
import { router, protectedProcedure, adminProcedure, tenantProcedure } from '../../trpc/trpc.js';
import {
  createTenantSchema,
  updateTenantSchema,
  inviteMemberSchema,
  acceptInviteSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
  switchTenantSchema,
} from '@proteticflow/shared';
import * as tenantService from './service.js';
import type { Role } from '@proteticflow/shared';

export const tenantRouter = router({
  // ── Sem tenant obrigatório (user pode ainda não ter tenant) ──────────────
  create: protectedProcedure
    .input(createTenantSchema)
    .mutation(async ({ input, ctx }) => {
      return tenantService.createTenant(ctx.user!.id, input);
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      return tenantService.listUserTenants(ctx.user!.id);
    }),

  switchTenant: protectedProcedure
    .input(switchTenantSchema)
    .mutation(async ({ input, ctx }) => {
      await tenantService.switchTenant(ctx.user!.id, input.tenantId);
      return { success: true };
    }),

  acceptInvite: protectedProcedure
    .input(acceptInviteSchema)
    .mutation(async ({ input, ctx }) => {
      await tenantService.acceptInvite(input.token, ctx.user!.id);
      return { success: true };
    }),

  // ── Requer tenant ativo (qualquer membro) ─────────────────────────────────
  getCurrent: tenantProcedure
    .query(async ({ ctx }) => {
      return tenantService.getTenant(ctx.tenantId!);
    }),

  // ── Requer tenant ativo + admin (superadmin | gerente) ───────────────────
  update: adminProcedure
    .input(updateTenantSchema)
    .mutation(async ({ input, ctx }) => {
      return tenantService.updateTenant(ctx.tenantId!, ctx.user!.id, input);
    }),

  deactivate: adminProcedure
    .mutation(async ({ ctx }) => {
      await tenantService.deactivateTenant(ctx.tenantId!, ctx.user!.id);
      return { success: true };
    }),

  invite: adminProcedure
    .input(inviteMemberSchema)
    .mutation(async ({ input, ctx }) => {
      return tenantService.inviteMember(ctx.tenantId!, ctx.user!.id, input);
    }),

  listMembers: adminProcedure
    .query(async ({ ctx }) => {
      return tenantService.listMembers(ctx.tenantId!);
    }),

  updateMemberRole: adminProcedure
    .input(updateMemberRoleSchema)
    .mutation(async ({ input, ctx }) => {
      await tenantService.updateMemberRole(ctx.tenantId!, input.memberId, input.role as Role);
      return { success: true };
    }),

  removeMember: adminProcedure
    .input(removeMemberSchema)
    .mutation(async ({ input, ctx }) => {
      await tenantService.removeMember(ctx.tenantId!, input.memberId);
      return { success: true };
    }),

  listInvites: adminProcedure
    .query(async ({ ctx }) => {
      return tenantService.listInvites(ctx.tenantId!);
    }),

  revokeInvite: adminProcedure
    .input(z.object({ inviteId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await tenantService.revokeInvite(ctx.tenantId!, input.inviteId);
      return { success: true };
    }),
});
