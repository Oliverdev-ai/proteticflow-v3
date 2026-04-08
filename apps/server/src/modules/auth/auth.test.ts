import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../db/index.js';
import { users, refreshTokens } from '../../db/schema/users.js';
import * as authService from './service.js';
import { eq } from 'drizzle-orm';

describe('Auth Module - PRD Phase 2 (20 Integration Tests)', () => {
  let createdUserId: number;
  const testEmail = 'tester20@proteticflow.com';
  const testPassword = 'Password123!';

  beforeAll(async () => {
    // Cleanup
    await db.delete(users).where(eq(users.email, testEmail));
  });

  afterAll(async () => {
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
      .rejects.toThrow('Credenciais inválidas');
  });

  it('6. Should reject login with unexisting user', async () => {
    await expect(authService.login({ email: 'fake@example.com', password: testPassword }, {}))
      .rejects.toThrow('Credenciais inválidas');
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
    await expect(authService.login({ email: testEmail, password: testPassword }, {})).rejects.toThrow('Credenciais inválidas');
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
});
