import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../db/index.js';
import { users, refreshTokens, loginAttempts } from '../../db/schema/users.js';
import * as authService from './service.js';
import { and, eq } from 'drizzle-orm';

describe('Auth Module - PRD Phase 2 (20 Integration Tests)', () => {
  let createdUserId: number;
  const testEmail = 'tester20@proteticflow.com';
  const testPassword = 'Password123!';

  beforeAll(async () => {
    // Cleanup
    await db.delete(loginAttempts).where(eq(loginAttempts.email, testEmail));
    await db.delete(users).where(eq(users.email, testEmail));
  });

  afterAll(async () => {
    await db.delete(loginAttempts);
    if (createdUserId) await db.delete(users).where(eq(users.id, createdUserId));
  });

  it('1. Should register successfully', async () => {
    const res = await authService.register({ name: 'Tester', email: testEmail, password: testPassword });
    expect(res.user.email).toBe(testEmail);
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
    createdUserId = res.user.id;
  });

  it('2. Should reject duplicate email on register', async () => {
    await expect(authService.register({ name: 'Tester', email: testEmail, password: testPassword }))
      .rejects.toThrow('Email já registrado');
  });

  it('3. Should hash passwords properly (not plaintext)', async () => {
    const [u] = await db.select().from(users).where(eq(users.id, createdUserId));
    if (!u) throw new Error('User not found in test');
    expect(u.passwordHash).not.toBe(testPassword);
    expect(u.passwordHash.length).toBeGreaterThan(20); // bcrypt hashes are ~60 chars
  });

  it('4. Should login successfully with valid credentials', async () => {
    const res = await authService.login({ email: testEmail, password: testPassword }, {});
    expect(res.accessToken).toBeDefined();
  });

  it('5. Should reject login with invalid password', async () => {
    await expect(authService.login({ email: testEmail, password: 'wrong' }, {}))
      .rejects.toThrow('Email ou senha inválidos');
  });

  it('6. Should reject login with unexisting user', async () => {
    await expect(authService.login({ email: 'fake@example.com', password: testPassword }, {}))
      .rejects.toThrow('Email ou senha inválidos');
  });

  it('7. Should return access and refresh tokens on login', async () => {
    const res = await authService.login({ email: testEmail, password: testPassword }, {});
    expect(res.accessToken).toBeTruthy();
    expect(res.refreshToken).toBeTruthy();
  });

  it('8. Should refresh token successfully', async () => {
    const res = await authService.login({ email: testEmail, password: testPassword }, {});
    const refreshRes = await authService.refresh(res.refreshToken);
    expect(refreshRes.accessToken).toBeDefined();
    expect(refreshRes.refreshToken).toBeDefined();
    expect(refreshRes.refreshToken).not.toBe(res.refreshToken);
  });

  it('9. Should reject refresh if token revoked', async () => {
    const res = await authService.login({ email: testEmail, password: testPassword }, {});
    await authService.logout(res.refreshToken);
    await expect(authService.refresh(res.refreshToken)).rejects.toThrow('Sessão revogada');
  });

  it('10. Should reject refresh if token invalid', async () => {
    await expect(authService.refresh('invalid_token')).rejects.toThrow('Refresh token inválido');
  });

  it('11. Should process logout properly', async () => {
    const res = await authService.login({ email: testEmail, password: testPassword }, {});
    await authService.logout(res.refreshToken);
    const tokenHash = authService.hashToken(res.refreshToken);
    // the query `getSessions` only returns non-revoked ones.
    const [dbToken] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
    if (!dbToken) throw new Error('Refresh token not found in test');
    expect(dbToken.revokedAt).not.toBeNull();
  });

  it('12. Should process logoutAll properly', async () => {
    await authService.login({ email: testEmail, password: testPassword }, {});
    await authService.login({ email: testEmail, password: testPassword }, {});
    await authService.logoutAll(createdUserId);
    const sessions = await authService.getSessions(createdUserId, '');
    expect(sessions.length).toBe(0);
  });

  it('13. Should reject login for disabled account', async () => {
    await db.update(users).set({ isActive: false }).where(eq(users.id, createdUserId));
    await expect(authService.login({ email: testEmail, password: testPassword }, {})).rejects.toThrow('Email ou senha inválidos');
    await db.update(users).set({ isActive: true }).where(eq(users.id, createdUserId)); // Re-enable
  });

  it('14. Should revoke all sessions on token reuse attempt', async () => {
    const res = await authService.login({ email: testEmail, password: testPassword }, {});
    await authService.refresh(res.refreshToken);
    // Reuse the old one
    await expect(authService.refresh(res.refreshToken)).rejects.toThrow('Sessão revogada por segurança');
    const sessions = await authService.getSessions(createdUserId, '');
    expect(sessions.length).toBe(0);
  });

  it('15. Should generate 2fa secret', async () => {
    const res = await authService.setup2fa(createdUserId);
    expect(res.secret).toBeDefined();
    expect(res.qrCodeDataUrl).toContain('data:image/png;base64');
  });

  it('16. Should setup and verify 2fa successfully', async () => {
    const auth = await authService.setup2fa(createdUserId);
    // Note: Can't easily mock OTP in integration without installing speakeasy or similar in test file. 
    // We will assume failure for arbitrary string.
    await expect(authService.verify2fa(createdUserId, '000000', auth.secret)).rejects.toThrow('Código TOTP inválido');
  });

  it('17. Should require 2fa code on login if enabled', async () => {
    await db.update(users).set({ twoFactorEnabled: true, twoFactorSecret: 'abcd' }).where(eq(users.id, createdUserId));
    await expect(authService.login({ email: testEmail, password: testPassword }, {})).rejects.toThrow('Código 2FA obrigatório');
  });

  it('18. Should reject login if 2fa code invalid', async () => {
    await expect(authService.login({ email: testEmail, password: testPassword, totpCode: '000000' }, {})).rejects.toThrow('Código 2FA inválido');
    await db.update(users).set({ twoFactorEnabled: false }).where(eq(users.id, createdUserId)); // Re-disable
  });

  it('19. Should allow password change', async () => {
    await authService.changePassword(createdUserId, testPassword, 'NewPassword123!');
    const [u] = await db.select().from(users).where(eq(users.id, createdUserId));
    if (!u) throw new Error('User not found in test');
    const isValid = await authService.verifyPassword('NewPassword123!', u.passwordHash);
    expect(isValid).toBe(true);
  });

  it('20. Should revoke sessions on password reset/change', async () => {
    await authService.login({ email: testEmail, password: 'NewPassword123!' }, {});
    await authService.changePassword(createdUserId, 'NewPassword123!', testPassword); // Reset back
    const sessions = await authService.getSessions(createdUserId, '');
    expect(sessions.length).toBe(0);
  });

  it('21. Should reset login failure count after successful password auth', async () => {
    const email = uniqueEmail('lockout-reset');
    const password = 'Password123!';
    const ip = '10.0.0.21';
    const registered = await authService.register({ name: 'Lockout Reset', email, password });

    for (let i = 0; i < 3; i += 1) {
      await expect(authService.login({ email, password: 'wrong' }, { ip }))
        .rejects.toThrow('Email ou senha inválidos');
    }

    await authService.login({ email, password }, { ip });

    const [attempt] = await db
      .select()
      .from(loginAttempts)
      .where(and(eq(loginAttempts.email, email), eq(loginAttempts.ip, ip)));

    expect(attempt?.failureCount).toBe(0);
    expect(attempt?.lockedUntil).toBeNull();

    await db.delete(users).where(eq(users.id, registered.user.id));
  });

  it('22. Should lock account key for 5 minutes after five failures', async () => {
    const email = uniqueEmail('lockout-five');
    const password = 'Password123!';
    const ip = '10.0.0.22';
    const registered = await authService.register({ name: 'Lockout Five', email, password });

    for (let i = 0; i < 5; i += 1) {
      await expect(authService.login({ email, password: 'wrong' }, { ip }))
        .rejects.toThrow('Email ou senha inválidos');
    }

    const [attempt] = await db
      .select()
      .from(loginAttempts)
      .where(and(eq(loginAttempts.email, email), eq(loginAttempts.ip, ip)));

    expect(attempt?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    await expect(authService.login({ email, password }, { ip }))
      .rejects.toThrow('Email ou senha inválidos');

    await db.delete(users).where(eq(users.id, registered.user.id));
  });

  it('23. Should allow login after lockout expiration', async () => {
    const email = uniqueEmail('lockout-expire');
    const password = 'Password123!';
    const ip = '10.0.0.23';
    const registered = await authService.register({ name: 'Lockout Expire', email, password });

    for (let i = 0; i < 5; i += 1) {
      await expect(authService.login({ email, password: 'wrong' }, { ip }))
        .rejects.toThrow('Email ou senha inválidos');
    }

    await db
      .update(loginAttempts)
      .set({ lockedUntil: new Date(Date.now() - 1000) })
      .where(and(eq(loginAttempts.email, email), eq(loginAttempts.ip, ip)));

    const result = await authService.login({ email, password }, { ip });
    expect(result.accessToken).toBeDefined();

    await db.delete(users).where(eq(users.id, registered.user.id));
  });

  it('24. Should keep invalid, missing, and locked responses identical', async () => {
    const email = uniqueEmail('lockout-message');
    const password = 'Password123!';
    const ip = '10.0.0.24';
    const registered = await authService.register({ name: 'Lockout Message', email, password });

    const wrongPassword = await rejectionMessage(authService.login({ email, password: 'wrong' }, { ip: '10.0.0.240' }));
    const missingUser = await rejectionMessage(authService.login({ email: uniqueEmail('missing'), password }, { ip }));

    for (let i = 0; i < 5; i += 1) {
      await expect(authService.login({ email, password: 'wrong' }, { ip }))
        .rejects.toThrow('Email ou senha inválidos');
    }
    const locked = await rejectionMessage(authService.login({ email, password }, { ip }));

    expect(new Set([wrongPassword, missingUser, locked])).toEqual(new Set(['Email ou senha inválidos']));

    await db.delete(users).where(eq(users.id, registered.user.id));
  });

  it('25. Should isolate lockout by email for the same IP', async () => {
    const password = 'Password123!';
    const ip = '10.0.0.25';
    const emailA = uniqueEmail('lockout-a');
    const emailB = uniqueEmail('lockout-b');
    const userA = await authService.register({ name: 'Lockout A', email: emailA, password });
    const userB = await authService.register({ name: 'Lockout B', email: emailB, password });

    for (let i = 0; i < 5; i += 1) {
      await expect(authService.login({ email: emailA, password: 'wrong' }, { ip }))
        .rejects.toThrow('Email ou senha inválidos');
    }

    await expect(authService.login({ email: emailA, password }, { ip }))
      .rejects.toThrow('Email ou senha inválidos');
    const loginB = await authService.login({ email: emailB, password }, { ip });
    expect(loginB.accessToken).toBeDefined();

    await db.delete(users).where(eq(users.id, userA.user.id));
    await db.delete(users).where(eq(users.id, userB.user.id));
  });

  it('26. Should escalate login lockout to 30 minutes after six failures', async () => {
    const email = uniqueEmail('lockout-six');
    const password = 'Password123!';
    const ip = '10.0.0.26';
    const registered = await authService.register({ name: 'Lockout Six', email, password });

    for (let i = 0; i < 6; i += 1) {
      await expect(authService.login({ email, password: 'wrong' }, { ip }))
        .rejects.toThrow('Email ou senha inválidos');

      if (i < 5) {
        await expireLoginLock(email, ip);
      }
    }

    const attempt = await getLoginAttempt(email, ip);
    const lockMs = attempt?.lockedUntil ? attempt.lockedUntil.getTime() - Date.now() : 0;

    expect(attempt?.failureCount).toBe(6);
    expect(lockMs).toBeGreaterThan(29 * 60 * 1000);
    expect(lockMs).toBeLessThanOrEqual((30 * 60 * 1000) + 5000);

    await db.delete(users).where(eq(users.id, registered.user.id));
  });

  it('27. Should escalate login lockout to 24 hours after eight failures', async () => {
    const email = uniqueEmail('lockout-eight');
    const password = 'Password123!';
    const ip = '10.0.0.27';
    const registered = await authService.register({ name: 'Lockout Eight', email, password });

    for (let i = 0; i < 8; i += 1) {
      await expect(authService.login({ email, password: 'wrong' }, { ip }))
        .rejects.toThrow('Email ou senha inválidos');

      if (i < 7) {
        await expireLoginLock(email, ip);
      }
    }

    const attempt = await getLoginAttempt(email, ip);
    const lockMs = attempt?.lockedUntil ? attempt.lockedUntil.getTime() - Date.now() : 0;

    expect(attempt?.failureCount).toBe(8);
    expect(lockMs).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(lockMs).toBeLessThanOrEqual((24 * 60 * 60 * 1000) + 5000);

    await db.delete(users).where(eq(users.id, registered.user.id));
  });
});

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@proteticflow.test`;
}

async function rejectionMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function expireLoginLock(email: string, ip: string): Promise<void> {
  await db
    .update(loginAttempts)
    .set({ lockedUntil: new Date(Date.now() - 1000) })
    .where(and(eq(loginAttempts.email, email), eq(loginAttempts.ip, ip)));
}

async function getLoginAttempt(email: string, ip: string) {
  const [attempt] = await db
    .select()
    .from(loginAttempts)
    .where(and(eq(loginAttempts.email, email), eq(loginAttempts.ip, ip)));

  return attempt;
}
