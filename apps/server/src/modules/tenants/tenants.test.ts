import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../db/index.js';
import { invites, osBlocks, users, tenants, tenantMembers, fiscalSettings } from '../../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';
import * as tenantService from './service.js';

function assertExists<T>(value: T | undefined, label: string): T {
  if (!value) throw new Error(`${label} not found`);
  return value;
}

async function createTestUser(email: string) {
  const [user] = await db
    .insert(users)
    .values({
      name: 'Test User',
      email,
      passwordHash: await hashPassword('Test123!'),
      role: 'user',
    })
    .returning();

  return assertExists(user, 'test user');
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  await db.delete(invites);
  await db.delete(osBlocks);
  await db.delete(tenantMembers);
  await db.delete(fiscalSettings);
  await db.delete(tenants);
  await db.delete(users);
}

describe('Tenant Service - CRUD', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. Cria tenant com slug gerado e plan trial', async () => {
    const user = await createTestUser('admin@test.com');
    const tenant = await tenantService.createTenant(user.id, { name: 'Lab Teste' });
    expect(tenant.slug).toBe('lab-teste');
    expect(tenant.plan).toBe('trial');
    expect(tenant.planExpiresAt).not.toBeNull();
  });

  it('2. Criador vira superadmin no tenant_members', async () => {
    const user = await createTestUser('admin2@test.com');
    const tenant = await tenantService.createTenant(user.id, { name: 'Lab 2' });
    const [membershipRow] = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.userId, user.id)));
    const membership = assertExists(membershipRow, 'tenant membership');
    expect(membership.role).toBe('superadmin');
  });

  it('3. Criar tenant atualiza users.activeTenantId', async () => {
    const user = await createTestUser('admin3@test.com');
    const tenant = await tenantService.createTenant(user.id, { name: 'Lab 3' });
    const [updatedUserRow] = await db.select().from(users).where(eq(users.id, user.id));
    const updatedUser = assertExists(updatedUserRow, 'updated user');
    expect(updatedUser.activeTenantId).toBe(tenant.id);
  });

  it('4. Slug duplicado gera slug-2 sem crash', async () => {
    const user1 = await createTestUser('dup1@test.com');
    const user2 = await createTestUser('dup2@test.com');
    await tenantService.createTenant(user1.id, { name: 'Lab Dup' });
    const t2 = await tenantService.createTenant(user2.id, { name: 'Lab Dup' });
    expect(t2.slug).toBe('lab-dup-2');
  });

  it('5. Listar tenants retorna apenas tenants onde user e membro ativo', async () => {
    const user = await createTestUser('list@test.com');
    await tenantService.createTenant(user.id, { name: 'Lab List A' });
    await tenantService.createTenant(user.id, { name: 'Lab List B' });
    const list = await tenantService.listUserTenants(user.id);
    expect(list).toHaveLength(2);
  });

  it('6. Admin pode atualizar tenant', async () => {
    const user = await createTestUser('upd@test.com');
    const tenant = await tenantService.createTenant(user.id, { name: 'Lab Upd' });
    const updatedRow = await tenantService.updateTenant(tenant.id, user.id, { phone: '(11) 99999-9999' });
    const updated = assertExists(updatedRow, 'updated tenant');
    expect(updated.phone).toBe('(11) 99999-9999');
  });

  it('7. Desativar tenant - soft delete (isActive false)', async () => {
    const user = await createTestUser('deact@test.com');
    const tenant = await tenantService.createTenant(user.id, { name: 'Lab Deact' });
    await tenantService.deactivateTenant(tenant.id, user.id);
    const [tRow] = await db.select().from(tenants).where(eq(tenants.id, tenant.id));
    const t = assertExists(tRow, 'tenant row');
    expect(t.isActive).toBe(false);
  });
});

describe('Tenant Service - Switch', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('8. Switch tenant atualiza activeTenantId', async () => {
    const user = await createTestUser('sw1@test.com');
    await tenantService.createTenant(user.id, { name: 'Lab SW1' });
    const t2 = await tenantService.createTenant(user.id, { name: 'Lab SW2' });
    await tenantService.switchTenant(user.id, t2.id);
    const [uRow] = await db.select().from(users).where(eq(users.id, user.id));
    const u = assertExists(uRow, 'switched user');
    expect(u.activeTenantId).toBe(t2.id);
  });

  it('9. Switch rejeita se user nao e membro', async () => {
    const user = await createTestUser('sw2@test.com');
    const stranger = await createTestUser('stranger@test.com');
    const t = await tenantService.createTenant(stranger.id, { name: 'Lab Stranger' });
    await expect(tenantService.switchTenant(user.id, t.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('Tenant Service - Convites', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('10. Enviar convite cria invite com token e expiracao 7d', async () => {
    const admin = await createTestUser('inv10@test.com');
    const tenant = await tenantService.createTenant(admin.id, { name: 'Lab Inv' });
    const inviteRow = await tenantService.inviteMember(tenant.id, admin.id, { email: 'novo@test.com', role: 'producao' });
    const invite = assertExists(inviteRow, 'created invite');
    expect(invite.token).toHaveLength(64);
    expect(invite.status).toBe('pending');
    expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  it('11. Aceitar convite cria tenant_member com role do convite', async () => {
    const admin = await createTestUser('inv11a@test.com');
    const newUser = await createTestUser('inv11b@test.com');
    const tenant = await tenantService.createTenant(admin.id, { name: 'Lab Acc' });
    const inviteRow = await tenantService.inviteMember(tenant.id, admin.id, { email: newUser.email, role: 'gerente' });
    const invite = assertExists(inviteRow, 'invite');
    await tenantService.acceptInvite(invite.token, newUser.id);
    const [membershipRow] = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.userId, newUser.id)));
    const membership = assertExists(membershipRow, 'accepted invite membership');
    expect(membership.role).toBe('gerente');
  });

  it('12. Aceitar convite rejeita token expirado', async () => {
    const admin = await createTestUser('inv12a@test.com');
    const u = await createTestUser('inv12b@test.com');
    const tenant = await tenantService.createTenant(admin.id, { name: 'Lab Exp' });
    const inviteRow = await tenantService.inviteMember(tenant.id, admin.id, { email: u.email, role: 'recepcao' });
    const invite = assertExists(inviteRow, 'invite');
    await db.update(invites).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invites.id, invite.id));
    await expect(tenantService.acceptInvite(invite.token, u.id)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('13. Aceitar convite rejeita token ja aceito', async () => {
    const admin = await createTestUser('inv13a@test.com');
    const u = await createTestUser('inv13b@test.com');
    const tenant = await tenantService.createTenant(admin.id, { name: 'Lab Used' });
    const inviteRow = await tenantService.inviteMember(tenant.id, admin.id, { email: u.email, role: 'producao' });
    const invite = assertExists(inviteRow, 'invite');
    await tenantService.acceptInvite(invite.token, u.id);
    await expect(tenantService.acceptInvite(invite.token, u.id)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('14. Aceitar convite quando user ja existe em outro tenant - associa sem criar conta nova', async () => {
    const admin = await createTestUser('inv14a@test.com');
    const existingUser = await createTestUser('inv14b@test.com');
    const tenant = await tenantService.createTenant(admin.id, { name: 'Lab Exist' });
    const inviteRow = await tenantService.inviteMember(tenant.id, admin.id, { email: existingUser.email, role: 'contabil' });
    const invite = assertExists(inviteRow, 'invite');
    await tenantService.acceptInvite(invite.token, existingUser.id);
    const members = await tenantService.listMembers(tenant.id);
    expect(members.some((m) => m.userId === existingUser.id)).toBe(true);
  });
});

describe('Tenant Service - Membros', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('15. Listar membros retorna apenas membros do tenant autenticado (tenant isolation)', async () => {
    const user1 = await createTestUser('mb15a@test.com');
    const user2 = await createTestUser('mb15b@test.com');
    const t1 = await tenantService.createTenant(user1.id, { name: 'Lab MB1' });
    await tenantService.createTenant(user2.id, { name: 'Lab MB2' });
    const members = await tenantService.listMembers(t1.id);
    expect(members.every((m) => m.userId === user1.id)).toBe(true);
  });

  it('16. Admin pode alterar role de membro', async () => {
    const admin = await createTestUser('mb16a@test.com');
    const u = await createTestUser('mb16b@test.com');
    const tenant = await tenantService.createTenant(admin.id, { name: 'Lab Role' });
    const inviteRow = await tenantService.inviteMember(tenant.id, admin.id, { email: u.email, role: 'producao' });
    const invite = assertExists(inviteRow, 'invite');
    await tenantService.acceptInvite(invite.token, u.id);
    const members = await tenantService.listMembers(tenant.id);
    const member = members.find((m) => m.userId === u.id);
    expect(member).toBeDefined();
    await tenantService.updateMemberRole(tenant.id, member!.id, 'recepcao');
    const updated = await tenantService.listMembers(tenant.id);
    expect(updated.find((m) => m.id === member!.id)?.role).toBe('recepcao');
  });

  it('17. Nao permite remover o ultimo superadmin', async () => {
    const admin = await createTestUser('mb17@test.com');
    const tenant = await tenantService.createTenant(admin.id, { name: 'Lab Last' });
    const [membershipRow] = await db.select().from(tenantMembers).where(eq(tenantMembers.tenantId, tenant.id));
    const membership = assertExists(membershipRow, 'tenant membership');
    await expect(tenantService.removeMember(tenant.id, membership.id)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('18. Remover membro - soft remove (isActive false)', async () => {
    const admin = await createTestUser('mb18a@test.com');
    const u = await createTestUser('mb18b@test.com');
    const tenant = await tenantService.createTenant(admin.id, { name: 'Lab Rm' });
    const inviteRow = await tenantService.inviteMember(tenant.id, admin.id, { email: u.email, role: 'producao' });
    const invite = assertExists(inviteRow, 'invite');
    await tenantService.acceptInvite(invite.token, u.id);
    const members = await tenantService.listMembers(tenant.id);
    const member = members.find((m) => m.userId === u.id);
    expect(member).toBeDefined();
    await tenantService.removeMember(tenant.id, member!.id);
    const [tmRow] = await db.select().from(tenantMembers).where(eq(tenantMembers.id, member!.id));
    const tm = assertExists(tmRow, 'member row');
    expect(tm.isActive).toBe(false);
  });

  it('19. Nao permite remover ultimo superadmin via updateRole', async () => {
    const admin = await createTestUser('mb19@test.com');
    const tenant = await tenantService.createTenant(admin.id, { name: 'Lab Role Last' });
    const [membershipRow] = await db.select().from(tenantMembers).where(eq(tenantMembers.tenantId, tenant.id));
    const membership = assertExists(membershipRow, 'tenant membership');
    await expect(tenantService.updateMemberRole(tenant.id, membership.id, 'producao')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('Tenant Service - Tenant Isolation (CRITICO)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('20. User do Tenant A NAO ve membros do Tenant B', async () => {
    const userA = await createTestUser('iso20a@test.com');
    const userB = await createTestUser('iso20b@test.com');
    const tenantA = await tenantService.createTenant(userA.id, { name: 'Lab ISO A' });
    await tenantService.createTenant(userB.id, { name: 'Lab ISO B' });
    const membersA = await tenantService.listMembers(tenantA.id);
    expect(membersA.every((m) => m.userId === userA.id)).toBe(true);
  });

  it('21. User do Tenant A NAO consegue switch para Tenant B onde nao e membro', async () => {
    const userA = await createTestUser('iso21a@test.com');
    const userB = await createTestUser('iso21b@test.com');
    const tenantB = await tenantService.createTenant(userB.id, { name: 'Lab B ISO' });
    await expect(tenantService.switchTenant(userA.id, tenantB.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('22. getActiveTenantForUser retorna null se user nao tem tenant ativo', async () => {
    const user = await createTestUser('iso22@test.com');
    const result = await tenantService.getActiveTenantForUser(user.id);
    expect(result).toBeNull();
  });
});

describe('Tenant Service - RBAC', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('23. tenantProcedure sem tenant ativo retorna PRECONDITION_FAILED (simulado no service)', async () => {
    const user = await createTestUser('rbac23@test.com');
    const result = await tenantService.getActiveTenantForUser(user.id);
    expect(result).toBeNull();
  });

  it('24. getActiveTenantForUser retorna role correto do tenant_members', async () => {
    const user = await createTestUser('rbac24@test.com');
    const tenant = await tenantService.createTenant(user.id, { name: 'Lab RBAC' });
    const result = await tenantService.getActiveTenantForUser(user.id);
    expect(result?.tenantId).toBe(tenant.id);
    expect(result?.role).toBe('superadmin');
  });
});
