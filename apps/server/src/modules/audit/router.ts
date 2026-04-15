import { z } from 'zod';
import {
  blockMemberSchema,
  listAuditLogsSchema,
} from '@proteticflow/shared';
import { router, adminProcedure, superadminProcedure, tenantProcedure } from '../../trpc/trpc.js';
import * as auditService from './service.js';

export const auditRouter = router({
  list: adminProcedure
    .input(listAuditLogsSchema)
    .query(({ ctx, input }) => auditService.listAuditLogs(ctx.tenantId!, input)),

  myLogs: tenantProcedure
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    }).optional())
    .query(({ ctx, input }) =>
      auditService.listAuditLogs(ctx.tenantId!, {
        page: input?.page ?? 1,
        limit: input?.limit ?? 20,
        userId: ctx.user!.id,
      })),

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
