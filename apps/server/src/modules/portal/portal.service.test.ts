import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { osBlocks, portalTokens, tenantMembers, tenants, users } from '../../db/schema/index.js';
import { clients } from '../../db/schema/clients.js';
import { hashPassword } from '../../core/auth.js';
import { __testOnly } from './service.js';
import * as portalService from './service.js';

// Mock email to avoid SMTP requirement in unit tests
vi.mock('../notifications/email.js', () => ({
  sendEmail: vi.fn(async () => ({ sent: false })),
}));

import { sendEmail } from '../notifications/email.js';

async function createUser(email: string) {
  const [user] = await db
    .insert(users)
    .values({ name: 'Portal User', email, passwordHash: await hashPassword('Test123!') })
    .returning();
  return user!;
}

async function createTenantFor(userId: number, name: string) {
  const { createTenant } = await import('../tenants/service.js');
  return createTenant(userId, { name });
}

async function createClient(tenantId: number, name: string) {
  const [client] = await db
    .insert(clients)
    .values({ tenantId, name, deletedAt: null })
    .returning();
  return client!;
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  await db.delete(portalTokens);
  await db.delete(osBlocks);
  await db.delete(clients);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('portal service', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('hashToken retorna hash deterministico SHA-256', () => {
    const raw = 'abc-secret-token';
    const h1 = __testOnly.hashToken(raw);
    const h2 = __testOnly.hashToken(raw);
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(h1).toMatch(/^[0-9a-f]+$/);
  });

  it('pickPublicJob nao vaza totalCents nem dados financeiros', () => {
    const job = {
      id: 1, code: 'OS-001', patientName: 'P', prothesisType: 'C',
      material: 'M', color: 'A1', status: 'in_progress',
      deadline: new Date(), deliveredAt: null,
      totalCents: 999999, discountCents: 100, taxCents: 50,
    } as unknown as Parameters<typeof __testOnly.pickPublicJob>[0];
    const pub = __testOnly.pickPublicJob(job);
    expect('totalCents' in pub).toBe(false);
    expect('discountCents' in pub).toBe(false);
    expect('taxCents' in pub).toBe(false);
    expect(pub.code).toBe('OS-001');
  });

  it('createPortalToken cria token e retorna token bruto', async () => {
    const user = await createUser('portal-create@test.com');
    const tenant = await createTenantFor(user.id, 'Tenant Portal');
    const client = await createClient(tenant.id, 'Cliente A');

    const result = await portalService.createPortalToken(tenant.id, { clientId: client.id, expiresInDays: 7 }, user.id);

    expect(result.token).toHaveLength(64);
    expect(result.portalUrlPath).toBe(`/portal/${result.token}`);
    expect(result.expiresAt).toBeTruthy();
  });

  it('getPortalSnapshotByToken aceita token valido e retorna snapshot sem dados financeiros', async () => {
    const user = await createUser('portal-snap@test.com');
    const tenant = await createTenantFor(user.id, 'Tenant Snap');
    const client = await createClient(tenant.id, 'Cliente Snap');

    const created = await portalService.createPortalToken(tenant.id, { clientId: client.id, expiresInDays: 1 }, user.id);
    const snapshot = await portalService.getPortalSnapshotByToken(created.token);

    expect(snapshot.clientName).toBe('Cliente Snap');
    expect(snapshot.jobs).toBeInstanceOf(Array);
    // Nenhum campo financeiro no snapshot
    expect(JSON.stringify(snapshot)).not.toContain('totalCents');
    expect(JSON.stringify(snapshot)).not.toContain('discountCents');
  });

  it('getPortalSnapshotByToken rejeita token expirado', async () => {
    const user = await createUser('portal-exp@test.com');
    const tenant = await createTenantFor(user.id, 'Tenant Exp');
    const client = await createClient(tenant.id, 'Cliente Exp');

    const created = await portalService.createPortalToken(tenant.id, { clientId: client.id, expiresInDays: 1 }, user.id);

    // Simula expiração forçando update no DB
    await db.update(portalTokens)
      .set({ expiresAt: new Date('2000-01-01') })
      .where(eq(portalTokens.id, created.id));

    await expect(portalService.getPortalSnapshotByToken(created.token)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('getPortalSnapshotByToken rejeita token revogado', async () => {
    const user = await createUser('portal-rev@test.com');
    const tenant = await createTenantFor(user.id, 'Tenant Rev');
    const client = await createClient(tenant.id, 'Cliente Rev');

    const created = await portalService.createPortalToken(tenant.id, { clientId: client.id, expiresInDays: 1 }, user.id);
    await portalService.revokePortalToken(tenant.id, created.id);

    await expect(portalService.getPortalSnapshotByToken(created.token)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('getPortalSnapshotByToken rejeita token invalido', async () => {
    await expect(portalService.getPortalSnapshotByToken('token-invalido-qualquer')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('sendPortalLink retorna success, link correto e tenta enviar email', async () => {
    const user = await createUser('portal-email@test.com');
    const tenant = await createTenantFor(user.id, 'Tenant Email');
    const client = await createClient(tenant.id, 'Cliente Email');

    const created = await portalService.createPortalToken(tenant.id, { clientId: client.id, expiresInDays: 1 }, user.id);
    const result = await portalService.sendPortalLink(tenant.id, created.id, 'dest@example.com', created.token);

    expect(result.success).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'dest@example.com',
      text: expect.stringContaining(`/portal/${created.token}`),
    }));
  });

  it('sendPortalLink lanca NOT_FOUND para tokenId inexistente', async () => {
    const user = await createUser('portal-notfound@test.com');
    const tenant = await createTenantFor(user.id, 'Tenant NF');
    const fakeToken = 'a'.repeat(64);

    await expect(portalService.sendPortalLink(tenant.id, 9999, 'a@b.com', fakeToken)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('sendPortalLink lanca NOT_FOUND se token bruto nao corresponde ao hash do registro', async () => {
    const user = await createUser('portal-mismatch@test.com');
    const tenant = await createTenantFor(user.id, 'Tenant Mismatch');
    const client = await createClient(tenant.id, 'Cliente Mismatch');

    const created = await portalService.createPortalToken(tenant.id, { clientId: client.id, expiresInDays: 1 }, user.id);
    const wrongToken = 'b'.repeat(64);

    await expect(portalService.sendPortalLink(tenant.id, created.id, 'a@b.com', wrongToken)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('sendPortalLink lanca BAD_REQUEST para token revogado', async () => {
    const user = await createUser('portal-rev2@test.com');
    const tenant = await createTenantFor(user.id, 'Tenant Rev2');
    const client = await createClient(tenant.id, 'Cliente Rev2');

    const created = await portalService.createPortalToken(tenant.id, { clientId: client.id, expiresInDays: 1 }, user.id);
    await portalService.revokePortalToken(tenant.id, created.id);

    await expect(portalService.sendPortalLink(tenant.id, created.id, 'a@b.com', created.token)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('revokePortalToken lanca NOT_FOUND para token de outro tenant', async () => {
    const user = await createUser('portal-iso@test.com');
    const tenant = await createTenantFor(user.id, 'Tenant Iso');
    const client = await createClient(tenant.id, 'Cliente Iso');

    const created = await portalService.createPortalToken(tenant.id, { clientId: client.id, expiresInDays: 1 }, user.id);

    // Tenta revogar com tenantId errado
    await expect(portalService.revokePortalToken(999, created.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
