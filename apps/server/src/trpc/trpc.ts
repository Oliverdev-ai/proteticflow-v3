import { initTRPC, TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { db } from '../db/index.js';
import { tenantMembers } from '../db/schema/tenants.js';
import {
  checkAiAccess,
  checkFeatureAccess,
  checkManagerActionLimit,
  consumeManagerAction,
} from '../modules/licensing/service.js';
import type { TrpcContext } from './context.js';

const t = initTRPC.context<TrpcContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

const enforceTenant = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (!ctx.tenantId || ctx.tenantId === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Selecione um laboratorio antes de continuar',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId: ctx.tenantId,
    },
  });
});

const enforceNotBlocked = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.tenantId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  const [member] = await db
    .select({
      blockedAt: tenantMembers.blockedAt,
      blockedReason: tenantMembers.blockedReason,
    })
    .from(tenantMembers)
    .where(and(
      eq(tenantMembers.tenantId, ctx.tenantId),
      eq(tenantMembers.userId, ctx.user.id),
      eq(tenantMembers.isActive, true),
    ))
    .limit(1);

  if (member?.blockedAt) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Acesso bloqueado: ${member.blockedReason ?? 'Contate o administrador'}`,
    });
  }

  return next({ ctx });
});

const ACTION_LIMIT_EXEMPT_PATHS = new Set([
  'licensing.createCheckoutSession',
  'licensing.createBillingPortalSession',
  'licensing.adminUpdatePlan',
]);

const enforceManagerActions = t.middleware(async ({ ctx, path, type, next }) => {
  if (!ctx.tenantId || type !== 'mutation' || ACTION_LIMIT_EXEMPT_PATHS.has(path)) {
    return next({ ctx });
  }

  await checkManagerActionLimit(ctx.tenantId);
  const result = await next({ ctx });
  await consumeManagerAction(ctx.tenantId);
  return result;
});

export const tenantProcedure = t.procedure
  .use(enforceAuth)
  .use(enforceTenant)
  .use(enforceNotBlocked)
  .use(enforceManagerActions);

const enforceAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });

  const [member] = await db
    .select({ role: tenantMembers.role })
    .from(tenantMembers)
    .where(and(
      eq(tenantMembers.tenantId, ctx.tenantId),
      eq(tenantMembers.userId, ctx.user.id),
      eq(tenantMembers.isActive, true),
    ))
    .limit(1);

  if (!member || !['superadmin', 'gerente'].includes(member.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito a administradores' });
  }
  return next({ ctx: { ...ctx, user: ctx.user, tenantId: ctx.tenantId } });
});

export const adminProcedure = tenantProcedure.use(enforceAdmin);

const enforceSuperadmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });

  const [member] = await db
    .select({ role: tenantMembers.role })
    .from(tenantMembers)
    .where(and(
      eq(tenantMembers.tenantId, ctx.tenantId),
      eq(tenantMembers.userId, ctx.user.id),
      eq(tenantMembers.isActive, true),
    ))
    .limit(1);

  if (!member || member.role !== 'superadmin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Acesso restrito ao superadmin',
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user, tenantId: ctx.tenantId } });
});

export const superadminProcedure = protectedProcedure.use(enforceSuperadmin);

const enforceLicense = t.middleware(async ({ ctx, next }) => next({ ctx }));

const enforceFinancial = t.middleware(async ({ ctx, next }) => {
  if (!ctx.tenantId) throw new TRPCError({ code: 'PRECONDITION_FAILED' });
  await checkFeatureAccess(ctx.tenantId, 'financial');
  return next({ ctx });
});

const enforceReports = t.middleware(async ({ ctx, next }) => {
  if (!ctx.tenantId) throw new TRPCError({ code: 'PRECONDITION_FAILED' });
  await checkFeatureAccess(ctx.tenantId, 'reports');
  return next({ ctx });
});

const enforceAiBasic = t.middleware(async ({ ctx, next }) => {
  if (!ctx.tenantId) throw new TRPCError({ code: 'PRECONDITION_FAILED' });
  await checkAiAccess(ctx.tenantId, 'basic');
  return next({ ctx });
});

const enforceAiFull = t.middleware(async ({ ctx, next }) => {
  if (!ctx.tenantId) throw new TRPCError({ code: 'PRECONDITION_FAILED' });
  await checkAiAccess(ctx.tenantId, 'full');
  return next({ ctx });
});

const enforceVoiceCommands = t.middleware(async ({ ctx, next }) => {
  if (!ctx.tenantId) throw new TRPCError({ code: 'PRECONDITION_FAILED' });
  await checkFeatureAccess(ctx.tenantId, 'voiceCommands');
  return next({ ctx });
});

export const licensedProcedure = tenantProcedure.use(enforceLicense);
export const financialProcedure = tenantProcedure.use(enforceFinancial);
export const financialAdminProcedure = adminProcedure.use(enforceFinancial);
export const reportsProcedure = tenantProcedure.use(enforceReports);
export const reportsAdminProcedure = adminProcedure.use(enforceReports);
export const aiProcedure = tenantProcedure.use(enforceAiBasic);
export const aiAdminProcedure = adminProcedure.use(enforceAiBasic);
export const aiFullProcedure = tenantProcedure.use(enforceAiFull);
export const aiFullAdminProcedure = adminProcedure.use(enforceAiFull);
export const voiceProcedure = tenantProcedure.use(enforceVoiceCommands);
export const voiceAdminProcedure = adminProcedure.use(enforceVoiceCommands);

export { t };


