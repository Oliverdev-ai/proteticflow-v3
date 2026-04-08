import { z } from 'zod';
import {
  blockMemberSchema,
  listAuditLogsSchema,
} from '@proteticflow/shared';
import { router, adminProcedure, superadminProcedure } from '../../trpc/trpc.js';
import * as auditService from './service.js';

export const auditRouter = router({
  list: adminProcedure
    .input(listAuditLogsSchema)
    .query(({ ctx, input }) => auditService.listAuditLogs(ctx.tenantId!, input)),

  usageSummary: adminProcedure
    .query(({ ctx }) => auditService.getTenantUsageSummary(ctx.tenantId!)),

  members: adminProcedure
    .query(({ ctx }) => auditService.listTenantMembers(ctx.tenantId!)),

  blockMember: adminProcedure
    .input(blockMemberSchema)
    .mutation(({ ctx, input }) =>
      auditService.blockMember(ctx.tenantId!, input.userId, ctx.user!.id, input.reason)),

  unblockMember: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      auditService.unblockMember(ctx.tenantId!, input.userId)),

  allTenants: superadminProcedure
    .query(() => auditService.listAllTenantsUsage()),
});
