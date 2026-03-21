import { router, publicProcedure, protectedProcedure, adminProcedure } from '../../trpc/trpc.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  setup2faSchema,
  verify2faSchema,
  createUserSchema
} from '@proteticflow/shared';
import { z } from 'zod';
import * as authService from './service.js';
import { hashToken } from '../../core/auth.js';

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ input }) => {
    return authService.register(input);
  }),
  login: publicProcedure.input(loginSchema).mutation(async ({ input, ctx }) => {
    const meta = { ip: ctx.req?.ip, userAgent: ctx.req?.headers['user-agent'] };
    const result = await authService.login(input, meta);
    
    if (ctx.res) {
      ctx.res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });
      ctx.res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/trpc/auth.refresh',
      });
    }
    
    return result;
  }),
  refresh: publicProcedure.mutation(async ({ ctx }) => {
    const refreshToken = ctx.req?.cookies?.refresh_token;
    if (!refreshToken) throw new Error('UNAUTHORIZED');
    const result = await authService.refresh(refreshToken);
    
    if (ctx.res) {
        ctx.res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
        path: '/',
        });
        ctx.res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/trpc/auth.refresh',
        });
    }
    return result;
  }),
  forgotPassword: publicProcedure.input(forgotPasswordSchema).mutation(async ({ input }) => {
    await authService.forgotPassword(input.email);
    return { success: true };
  }),
  resetPassword: publicProcedure.input(resetPasswordSchema).mutation(async ({ input }) => {
    await authService.resetPassword(input.token, input.password);
    return { success: true };
  }),
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const refreshToken = ctx.req?.cookies?.refresh_token;
    await authService.logout(refreshToken);
    ctx.res?.clearCookie('access_token');
    ctx.res?.clearCookie('refresh_token', { path: '/trpc/auth.refresh' });
    return { success: true };
  }),
  logoutAll: protectedProcedure.mutation(async ({ ctx }) => {
    await authService.logoutAll(ctx.user!.id);
    ctx.res?.clearCookie('access_token');
    ctx.res?.clearCookie('refresh_token', { path: '/trpc/auth.refresh' });
    return { success: true };
  }),
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return authService.getProfile(ctx.user!.id);
  }),
  updateProfile: protectedProcedure.input(updateProfileSchema).mutation(async ({ input, ctx }) => {
    return authService.updateProfile(ctx.user!.id, input);
  }),
  changePassword: protectedProcedure.input(changePasswordSchema).mutation(async ({ input, ctx }) => {
    await authService.changePassword(ctx.user!.id, input.currentPassword, input.newPassword);
    ctx.res?.clearCookie('access_token');
    ctx.res?.clearCookie('refresh_token', { path: '/trpc/auth.refresh' });
    return { success: true };
  }),
  getSessions: protectedProcedure.query(async ({ ctx }) => {
    const refreshToken = ctx.req?.cookies?.refresh_token;
    return authService.getSessions(ctx.user!.id, refreshToken ? hashToken(refreshToken) : '');
  }),
  revokeSession: protectedProcedure.input(z.object({ sessionId: z.number() })).mutation(async ({ input, ctx }) => {
    await authService.revokeSession(ctx.user!.id, input.sessionId);
    return { success: true };
  }),
  getPermissions: protectedProcedure.query(async ({ ctx }) => {
    return authService.getPermissions(ctx.user!.id, ctx.tenantId!);
  }),
  exportData: protectedProcedure.query(async ({ ctx }) => {
    return authService.exportUserData(ctx.user!.id);
  }),
  setup2fa: adminProcedure.mutation(async ({ ctx }) => {
    return authService.setup2fa(ctx.user!.id);
  }),
  verify2fa: adminProcedure.input(setup2faSchema.extend({ secret: z.string() })).mutation(async ({ input, ctx }) => {
    await authService.verify2fa(ctx.user!.id, input.totpCode, input.secret);
    return { success: true };
  }),
  disable2fa: adminProcedure.input(verify2faSchema).mutation(async ({ input, ctx }) => {
    await authService.disable2fa(ctx.user!.id, input.totpCode);
    return { success: true };
  }),
  listUsers: adminProcedure.query(async ({ ctx }) => {
    return authService.listUsers(ctx.tenantId!);
  }),
  createUser: adminProcedure.input(createUserSchema).mutation(async ({ input, ctx }) => {
    return authService.createUser(ctx.tenantId!, input);
  }),
});
