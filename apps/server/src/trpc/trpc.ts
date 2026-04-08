import { initTRPC, TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { db } from '../db/index.js';
import { tenantMembers, tenants } from '../db/schema/tenants.js';
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

// Garante que o usuário está autenticado E tem um tenant ativo.
// REGRA FASE 3+: toda procedure de negócio usa tenantProcedure (ou adminProcedure/licensedProcedure).
// NUNCA usar protectedProcedure diretamente em modules de negócio.
const enforceTenant = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  if (!ctx.tenantId || ctx.tenantId === 0) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Selecione um laboratório antes de continuar',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId: ctx.tenantId, // non-nullable a partir daqui
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

export const tenantProcedure = t.procedure.use(enforceAuth).use(enforceTenant).use(enforceNotBlocked);

const enforceAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.tenantId) throw new TRPCError({ code: 'UNAUTHORIZED' });
  
  const [member] = await db
    .select({ role: tenantMembers.role })
    .from(tenantMembers)
    .where(and(
      eq(tenantMembers.tenantId, ctx.tenantId),
      eq(tenantMembers.userId, ctx.user.id),
      eq(tenantMembers.isActive, true)
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
      eq(tenantMembers.isActive, true)
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

const enforceLicense = t.middleware(async ({ ctx, next }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED' });
  }

  const [tenant] = await db
    .select({ plan: tenants.plan, planExpiresAt: tenants.planExpiresAt })
    .from(tenants)
    .where(eq(tenants.id, ctx.tenantId))
    .limit(1);

  if (tenant?.plan === 'trial' && tenant.planExpiresAt && tenant.planExpiresAt < new Date()) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Periodo de trial encerrado. Faca upgrade para continuar.',
    });
  }

  return next({ ctx });
});

export const licensedProcedure = tenantProcedure.use(enforceLicense);

export { t };

