import { z } from 'zod';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, refreshTokens, passwordResetTokens, loginAttempts } from '../../db/schema/users.js';
import { tenantMembers, tenants } from '../../db/schema/tenants.js';
import { randomBytes } from 'crypto';
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
import { sendPasswordResetEmail } from '../notifications/email.js';
import { dispatchByPreference } from '../notifications/service.js';
import { decryptTotpSecretAtRest, encryptTotpSecret } from '../../core/crypto.js';
import { buildLgpdExportPayload } from '../ai/lgpd.service.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  createUserSchema,
  ROLE_PERMISSIONS,
  type Role,
} from '@proteticflow/shared';

// Infer types from schemas
type RegisterInput = z.infer<typeof registerSchema>;
type LoginInput = z.infer<typeof loginSchema>;
type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
type CreateUserInput = z.infer<typeof createUserSchema>;

const INVALID_CREDENTIALS_MESSAGE = 'Email ou senha inválidos';
const UNKNOWN_LOGIN_IP = 'unknown';

function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeLoginIp(ip: string | undefined): string {
  const normalized = ip?.trim();
  return (normalized && normalized.length > 0 ? normalized : UNKNOWN_LOGIN_IP).slice(0, 64);
}

function invalidCredentials(): never {
  throw new TRPCError({ code: 'UNAUTHORIZED', message: INVALID_CREDENTIALS_MESSAGE });
}

function calculateLockedUntil(failureCount: number, now: Date): Date | null {
  if (failureCount >= 8) return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (failureCount >= 6) return new Date(now.getTime() + 30 * 60 * 1000);
  if (failureCount >= 4) return new Date(now.getTime() + 5 * 60 * 1000);
  return null;
}

async function getLoginAttempt(email: string, ip: string) {
  const [attempt] = await db
    .select()
    .from(loginAttempts) // tenant-isolation-ok pre-auth login throttle keyed by email+ip
    .where(and(eq(loginAttempts.email, email), eq(loginAttempts.ip, ip)))
    .limit(1);
  return attempt ?? null;
}

async function assertLoginNotLocked(email: string, ip: string, now: Date): Promise<void> {
  const attempt = await getLoginAttempt(email, ip);
  if (attempt?.lockedUntil && attempt.lockedUntil > now) {
    invalidCredentials();
  }
}

async function recordLoginFailure(email: string, ip: string, now: Date): Promise<void> {
  const [attempt] = await db
    .insert(loginAttempts)
    .values({
      email,
      ip,
      failureCount: 1,
      lastFailedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [loginAttempts.email, loginAttempts.ip],
      set: {
        failureCount: sql`${loginAttempts.failureCount} + 1`,
        lastFailedAt: now,
        updatedAt: now,
      },
    })
    .returning({
      id: loginAttempts.id,
      failureCount: loginAttempts.failureCount,
    });

  if (!attempt) return;
  const lockedUntil = calculateLockedUntil(attempt.failureCount, now);
  await db
    .update(loginAttempts) // tenant-isolation-ok pre-auth login throttle keyed by email+ip
    .set({ lockedUntil, updatedAt: now })
    .where(eq(loginAttempts.id, attempt.id));
}

async function resetLoginAttempts(email: string, ip: string, now: Date): Promise<void> {
  await db
    .update(loginAttempts) // tenant-isolation-ok pre-auth login throttle keyed by email+ip
    .set({
      failureCount: 0,
      lastFailedAt: null,
      lockedUntil: null,
      updatedAt: now,
    })
    .where(and(eq(loginAttempts.email, email), eq(loginAttempts.ip, ip)));
}

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
  if (!user) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao registrar usuario' });
  }

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
  const email = normalizeLoginEmail(input.email);
  const lookupEmail = input.email.trim();
  const ip = normalizeLoginIp(meta.ip);
  const now = new Date();

  await assertLoginNotLocked(email, ip, now);

  const [user] = await db.select().from(users).where(eq(users.email, lookupEmail));
  if (!user || !user.isActive) {
    await recordLoginFailure(email, ip, now);
    invalidCredentials();
  }

  const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
  if (!isPasswordValid) {
    await recordLoginFailure(email, ip, now);
    invalidCredentials();
  }

  if (user.twoFactorEnabled) {
    if (!input.totpCode) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Código 2FA obrigatório' });
    }
    const storedTotpSecret = user.twoFactorSecret;
    if (!storedTotpSecret) {
      await recordLoginFailure(email, ip, now);
      invalidCredentials();
    }
    const isTotpValid = verify2faCode(decryptTotpSecretAtRest(storedTotpSecret), input.totpCode);
    if (!isTotpValid) {
      await recordLoginFailure(email, ip, now);
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

  const loginTokenData: typeof refreshTokens.$inferInsert = {
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
  if (meta.userAgent !== undefined) loginTokenData.userAgent = meta.userAgent;
  if (meta.ip !== undefined) loginTokenData.ipAddress = meta.ip;

  await db.insert(refreshTokens).values(loginTokenData);

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  await resetLoginAttempts(email, ip, new Date());

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

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hora
  });

  await sendPasswordResetEmail(user.email, token);

  if (user.activeTenantId) {
    await dispatchByPreference({
      tenantId: user.activeTenantId,
      userId: user.id,
      eventKey: 'password_reset',
      type: 'info',
      title: 'Reset de senha solicitado',
      message: 'Recebemos uma solicitacao de reset de senha para sua conta.',
      emailSubject: 'Reset de senha solicitado',
      emailText: 'Voce solicitou um reset de senha. Se nao foi voce, ignore este email.',
    });
  }

  logger.info({ action: 'auth.password_reset_request', userId: user.id }, 'Password reset requested');
  if (process.env.NODE_ENV === 'development') {
    logger.debug({ tokenPreview: token.slice(0, 8) + '...' }, 'Reset token (dev only)');
  }
}

export async function requestPasswordResetForProfile(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.email) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuario nao encontrado' });
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);

  const [resetRow] = await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
  }).returning({ id: passwordResetTokens.id });

  const emailResult = await sendPasswordResetEmail(user.email, token);
  if (!emailResult.sent) {
    if (resetRow) {
      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetRow.id));
    }
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'SMTP nao configurado. Configure o SMTP nas Configuracoes para redefinir a credencial.',
    });
  }

  if (user.activeTenantId) {
    await dispatchByPreference({
      tenantId: user.activeTenantId,
      userId: user.id,
      eventKey: 'password_reset',
      type: 'info',
      title: 'Reset de senha solicitado',
      message: 'Um link de redefinicao de senha foi enviado para seu email.',
      emailSubject: 'Reset de senha solicitado',
      emailText: 'Um link de redefinicao foi enviado para seu email cadastrado.',
    });
  }

  logger.info({ action: 'auth.password_reset_request.profile', userId }, 'Password reset requested from profile');
  return { success: true };
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
  if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuario nao encontrado' });
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
  if (!user || !user.email) throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuario nao encontrado' });
  const { secret, otpauthUrl } = generate2faSecret(user.email!);
  const qrCodeDataUrl = await generateQrCode(otpauthUrl);
  
  // We don't save the secret to DB yet. We only save it on verification to avoid locking user out if they abort sync.
  return { secret, qrCodeDataUrl };
}

export async function verify2fa(userId: number, code: string, secret: string) {
  const isValid = verify2faCode(secret, code);
  if (!isValid) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Código TOTP inválido' });

  await db.update(users).set({ twoFactorSecret: encryptTotpSecret(secret), twoFactorEnabled: true }).where(eq(users.id, userId));
  logger.info({ action: 'auth.2fa_enabled', userId }, '2FA Enabled');
}

export async function disable2fa(userId: number, code: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.twoFactorSecret) throw new TRPCError({ code: 'NOT_FOUND', message: '2FA nao configurado' });
  const isValid = verify2faCode(decryptTotpSecretAtRest(user.twoFactorSecret), code);
  if (!isValid) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Código TOTP inválido' });

  await db.update(users).set({ twoFactorSecret: null, twoFactorEnabled: false }).where(eq(users.id, userId));
  logger.info({ action: 'auth.2fa_disabled', userId }, '2FA Disabled');
}

export async function getProfile(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user;
}

export async function updateProfile(userId: number, input: UpdateProfileInput) {
  const updatePayload: Partial<typeof users.$inferInsert> = {};

  if (input.name !== undefined) {
    updatePayload.name = input.name;
  }
  if (input.phone !== undefined) {
    updatePayload.phone = input.phone;
  }
  if (input.aiVoiceEnabled !== undefined) {
    updatePayload.aiVoiceEnabled = input.aiVoiceEnabled;
  }
  if (input.aiVoiceGender !== undefined) {
    updatePayload.aiVoiceGender = input.aiVoiceGender;
  }
  if (input.aiVoiceSpeed !== undefined) {
    updatePayload.aiVoiceSpeed = input.aiVoiceSpeed;
  }

  updatePayload.updatedAt = new Date();

  const [updated] = await db.update(users).set(updatePayload).where(eq(users.id, userId)).returning();
  return updated;
}

export async function setThemePreference(
  userId: number,
  theme: 'system' | 'light' | 'dark',
): Promise<void> {
  await db
    .update(users)
    .set({ themePreference: theme, updatedAt: new Date() })
    .where(eq(users.id, userId));
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
  const [membership] = await db
    .select({ role: tenantMembers.role })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.userId, userId),
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.isActive, true),
      ),
    )
    .limit(1);

  const role = (membership?.role ?? 'recepcao') as Role;
  const permissions = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.recepcao;
  return { role, modules: permissions.modules };
}

export async function listUsers(tenantId: number) {
  // Real implementation using tenant_members (Fase 3)
  const { listMembers } = await import('../tenants/service.js');
  return listMembers(tenantId);
}

export async function createUser(tenantId: number, input: CreateUserInput) {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email));
  if (existing.length > 0) {
    throw new TRPCError({ code: 'CONFLICT', message: 'Email já registrado' });
  }

  const temporaryPassword = `Tmp${randomBytes(8).toString('hex')}A1`;
  const passwordHash = await hashPassword(temporaryPassword);

  const created = await db.transaction(async (tx) => {
    const [newUser] = await tx.insert(users).values({
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'user',
      activeTenantId: tenantId,
      isActive: true,
    }).returning();
    if (!newUser) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar usuario' });

    await tx.insert(tenantMembers).values({
      tenantId,
      userId: newUser.id,
      role: input.role,
      isActive: true,
    });

    return newUser;
  });

  logger.info({ action: 'auth.user.create', tenantId, userId: created.id, role: input.role }, 'Usuario criado via modulo auth');
  return created;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function exportUserData(userId: number, tenantId: number) {
  const [profile] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      phoneE164: users.phoneE164,
      phoneVerified: users.phoneVerified,
      whatsappOptIn: users.whatsappOptIn,
      aiVoiceEnabled: users.aiVoiceEnabled,
      aiVoiceGender: users.aiVoiceGender,
      aiVoiceSpeed: users.aiVoiceSpeed,
      themePreference: users.themePreference,
      avatarUrl: users.avatarUrl,
      role: users.role,
      activeTenantId: users.activeTenantId,
      isActive: users.isActive,
      twoFactorEnabled: users.twoFactorEnabled,
      lastSignedIn: users.lastSignedIn,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .innerJoin(tenantMembers, and(
      eq(tenantMembers.userId, users.id),
      eq(tenantMembers.tenantId, tenantId),
    ))
    .where(eq(users.id, userId))
    .limit(1);

  if (!profile) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Usuario nao pertence ao tenant informado' });
  }

  const memberships = await db
    .select({
      tenantId: tenantMembers.tenantId,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      role: tenantMembers.role,
      isActive: tenantMembers.isActive,
      blockedAt: tenantMembers.blockedAt,
      blockedReason: tenantMembers.blockedReason,
      joinedAt: tenantMembers.joinedAt,
      updatedAt: tenantMembers.updatedAt,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
    .where(and(
      eq(tenantMembers.userId, userId),
      eq(tenantMembers.tenantId, tenantId),
    ));

  const ai = await buildLgpdExportPayload(tenantId, userId);

  return {
    generatedAt: new Date().toISOString(),
    tenantId,
    userId,
    profile: {
      ...profile,
      lastSignedIn: toIso(profile.lastSignedIn),
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    },
    memberships: memberships.map((membership) => ({
      ...membership,
      blockedAt: toIso(membership.blockedAt),
      joinedAt: membership.joinedAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString(),
    })),
    ai,
  };
}

export { hashToken, verifyPassword };

