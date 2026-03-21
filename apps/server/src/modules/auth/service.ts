import { z } from 'zod';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, refreshTokens, passwordResetTokens } from '../../db/schema/users.js';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  generate2faSecret,
  verify2faCode,
  generateQrCode,
} from '../../core/auth.js';
import { logger } from '../../logger.js';
import { TRPCError } from '@trpc/server';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  createUserSchema,
  ROLES,
  ROLE_PERMISSIONS,
} from '@proteticflow/shared';

// Infer types from schemas
type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
type CreateUserInput = z.infer<typeof createUserSchema>;

export async function register(input: RegisterInput) {
  const existingUser = await db.select().from(users).where(eq(users.email, input.email));
  if (existingUser.length > 0) {
    throw new TRPCError({ code: 'CONFLICT', message: 'Email já registrado' });
  }

  const hashedPassword = await hashPassword(input.password);
  
  const [user] = await db.insert(users).values({
    name: input.name,
    email: input.email,
    passwordHash: hashedPassword,
    role: 'user',
  }).returning();

  logger.info({ action: 'auth.register', userId: user.id }, 'User registered');

  const accessToken = await generateAccessToken({
    sub: user.id,
    tenantId: user.activeTenantId || 0,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  });

  const refreshToken = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { user, accessToken, refreshToken };
}

export async function login(input: LoginInput, meta: { userAgent?: string; ip?: string }) {
  const [user] = await db.select().from(users).where(eq(users.email, input.email));
  if (!user || !user.isActive) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' });
  }

  const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Credenciais inválidas' });
  }

  if (user.twoFactorEnabled) {
    if (!input.totpCode) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Código 2FA obrigatório' });
    }
    const isTotpValid = verify2faCode(user.twoFactorSecret!, input.totpCode);
    if (!isTotpValid) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Código 2FA inválido' });
    }
  }

  const accessToken = await generateAccessToken({
    sub: user.id,
    tenantId: user.activeTenantId || 0,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  });

  const refreshToken = generateRefreshToken();
  const tokenHash = hashToken(refreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    userAgent: meta.userAgent,
    ipAddress: meta.ip,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

  logger.info({ action: 'auth.login', userId: user.id }, 'Login success');

  return { user, accessToken, refreshToken };
}

export async function refresh(token: string) {
  const tokenHash = hashToken(token);
  const [storedToken] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));

  if (!storedToken) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Refresh token inválido' });
  }

  if (storedToken.revokedAt) {
    // Reuse detected -> malicious behavior
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, storedToken.userId));
    logger.warn({ action: 'auth.refresh.reuse', userId: storedToken.userId }, 'Refresh token reuse detected — all sessions revoked');
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sessão revogada por segurança' });
  }

  if (storedToken.expiresAt < new Date()) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Refresh token expirado' });
  }

  const [user] = await db.select().from(users).where(eq(users.id, storedToken.userId));
  if (!user || !user.isActive) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Usuário desativado ou não encontrado' });
  }

  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, storedToken.id));

  const newAccessToken = await generateAccessToken({
    sub: user.id,
    tenantId: user.activeTenantId || 0,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60,
  });
  const newRefreshToken = generateRefreshToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashToken(newRefreshToken),
    userAgent: storedToken.userAgent,
    ipAddress: storedToken.ipAddress,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logout(refreshToken: string) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function logoutAll(userId: number) {
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, userId));
  logger.info({ action: 'auth.logoutAll', userId }, 'All sessions revoked');
}

export async function forgotPassword(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return; // Silent return for security

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hora
  });

  logger.info({ action: 'auth.password_reset_request', userId: user.id }, 'Password reset requested');
  if (process.env.NODE_ENV === 'development') {
    logger.debug({ tokenPreview: token.slice(0, 8) + '...' }, 'Reset token (dev only)');
  }
}

export async function resetPassword(token: string, newPassword: z.infer<typeof registerSchema>['password']) {
  const tokenHash = hashToken(token);
  const [resetReq] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));

  if (!resetReq || resetReq.usedAt || resetReq.expiresAt < new Date()) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Token inválido ou expirado' });
  }

  const hashedPassword = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, resetReq.userId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetReq.id));
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, resetReq.userId));
  });

  logger.info({ action: 'auth.password.changed', userId: resetReq.userId }, 'Password changed via reset');
}

export async function changePassword(userId: number, currentPass: string, newPass: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const isValid = await verifyPassword(currentPass, user.passwordHash);
  if (!isValid) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Senha atual incorreta' });

  const hashedPassword = await hashPassword(newPass);
  
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, userId));
    await tx.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, userId));
  });

  logger.info({ action: 'auth.password.changed', userId }, 'Password explicitly changed');
}

export async function setup2fa(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const { secret, otpauthUrl } = generate2faSecret(user.email!);
  const qrCodeDataUrl = await generateQrCode(otpauthUrl);
  
  // We don't save the secret to DB yet. We only save it on verification to avoid locking user out if they abort sync.
  return { secret, qrCodeDataUrl };
}

export async function verify2fa(userId: number, code: string, secret: string) {
  const isValid = verify2faCode(secret, code);
  if (!isValid) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Código TOTP inválido' });

  await db.update(users).set({ twoFactorSecret: secret, twoFactorEnabled: true }).where(eq(users.id, userId));
  logger.info({ action: 'auth.2fa_enabled', userId }, '2FA Enabled');
}

export async function disable2fa(userId: number, code: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const isValid = verify2faCode(user.twoFactorSecret!, code);
  if (!isValid) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Código TOTP inválido' });

  await db.update(users).set({ twoFactorSecret: null, twoFactorEnabled: false }).where(eq(users.id, userId));
  logger.info({ action: 'auth.2fa_disabled', userId }, '2FA Disabled');
}

export async function getProfile(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user;
}

export async function updateProfile(userId: number, input: UpdateProfileInput) {
  const [updated] = await db.update(users).set({
    ...(input.name && { name: input.name }),
    ...(input.phone && { phone: input.phone }),
  }).where(eq(users.id, userId)).returning();
  return updated;
}

export async function getSessions(userId: number, currentTokenHash: string) {
  const activeSessions = await db.select().from(refreshTokens)
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
    .orderBy(desc(refreshTokens.createdAt));

  return activeSessions.map(s => ({
    id: s.id,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt.toISOString(),
    current: s.tokenHash === currentTokenHash,
  }));
}

export async function revokeSession(userId: number, sessionId: number) {
  await db.update(refreshTokens).set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.id, sessionId), eq(refreshTokens.userId, userId)));
}

export async function getPermissions(userId: number, tenantId: number) {
  // Implementations for Phase 2
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const permissions = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] ?? ROLE_PERMISSIONS.recepcao;
  return { role: user.role, modules: permissions.modules };
}

export async function listUsers(tenantId: number) {
  // Real implementation using tenant_members (Fase 3)
  const { listMembers } = await import('../tenants/service.js');
  return listMembers(tenantId);
}

export async function createUser(tenantId: number, input: CreateUserInput) {
  const { createUser: createTenantUser } = await import('../tenants/service.js');
  return createTenantUser(tenantId, input);
}

export async function exportUserData(userId: number) {
  const [profile] = await db.select().from(users).where(eq(users.id, userId));
  // Gather other data associated with the user for LGPD compliance points (stub for now).
  return {
    profile,
    memberships: [],
    exportDate: new Date().toISOString(),
  };
}
