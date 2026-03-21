import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
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

export const tenantProcedure = t.procedure.use(enforceAuth).use(enforceTenant);

const enforceAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  if (!['superadmin', 'gerente'].includes(ctx.user.role)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso restrito a administradores' });
  }
  return next({ ctx: { ...ctx, user: ctx.user, tenantId: ctx.tenantId } });
});

export const adminProcedure = tenantProcedure.use(enforceAdmin);

const enforceLicense = t.middleware(({ ctx, next }) => {
  // TODO Fase 23: verificar limites do plano aqui
  return next({ ctx });
});

export const licensedProcedure = tenantProcedure.use(enforceLicense);

export { t };

