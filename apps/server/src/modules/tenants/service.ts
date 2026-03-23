import { randomBytes } from 'crypto';
import { eq, and, sql, gt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { tenants, tenantMembers, invites } from '../../db/schema/index.js';
import { users } from '../../db/schema/index.js';
import { logger } from '../../logger.js';
import type { TenantInfo, TenantMember, PendingInvite } from '@proteticflow/shared';
import type { Role } from '@proteticflow/shared';

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 64);
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let n = 1;

  while (true) {
    const [existing] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug));
    if (!existing) return slug;
    slug = `${base}-${++n}`;
  }
}

// ─── Read helpers (used by context factory) ──────────────────────────────────

export async function getActiveTenantForUser(userId: number): Promise<{ tenantId: number; role: Role } | null> {
  const [user] = await db.select({ activeTenantId: users.activeTenantId }).from(users).where(eq(users.id, userId));
  if (!user?.activeTenantId) return null;

  const [membership] = await db
    .select({ role: tenantMembers.role })
    .from(tenantMembers)
    .where(and(
      eq(tenantMembers.tenantId, user.activeTenantId),
      eq(tenantMembers.userId, userId),
      eq(tenantMembers.isActive, true),
    ));

  if (!membership) return null;

  return { tenantId: user.activeTenantId, role: membership.role as Role };
}

// ─── Tenant CRUD ─────────────────────────────────────────────────────────────

export async function createTenant(
  userId: number,
  input: {
    name: string;
    cnpj?: string | undefined;
    phone?: string | undefined;
    email?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
  },
) {
  const slug = await generateUniqueSlug(input.name);
  const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

  const tenant = await db.transaction(async (tx) => {
    const tenantData: typeof tenants.$inferInsert = {
      name: input.name,
      slug,
      plan: 'trial',
      planExpiresAt,
      userCount: 1,
    };
    if (input.cnpj !== undefined) tenantData.cnpj = input.cnpj;
    if (input.phone !== undefined) tenantData.phone = input.phone;
    if (input.email !== undefined) tenantData.email = input.email;
    if (input.address !== undefined) tenantData.address = input.address;
    if (input.city !== undefined) tenantData.city = input.city;
    if (input.state !== undefined) tenantData.state = input.state;

    const [t] = await tx.insert(tenants).values(tenantData).returning();
    if (!t) {
      throw new Error('Falha ao criar tenant');
    }

    await tx.insert(tenantMembers).values({
      tenantId: t.id,
      userId,
      role: 'superadmin',
    });

    await tx.update(users).set({ activeTenantId: t.id }).where(eq(users.id, userId));

    return t;
  });

  logger.info({ action: 'tenant.create', tenantId: tenant.id, userId, slug }, 'Tenant criado');
  return tenant;
}

export async function listUserTenants(userId: number): Promise<TenantInfo[]> {
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      plan: tenants.plan,
      role: tenantMembers.role,
      logoUrl: tenants.logoUrl,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
    .where(and(
      eq(tenantMembers.userId, userId),
      eq(tenantMembers.isActive, true),
      eq(tenants.isActive, true),
    ));

  return rows.map(r => ({ ...r, role: r.role as Role }));
}

export async function switchTenant(userId: number, tenantId: number): Promise<void> {
  const [membership] = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(and(
      eq(tenantMembers.tenantId, tenantId),
      eq(tenantMembers.userId, userId),
      eq(tenantMembers.isActive, true),
    ));

  if (!membership) {
    const { TRPCError } = await import('@trpc/server');
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Você não é membro deste laboratório' });
  }

  await db.update(users).set({ activeTenantId: tenantId }).where(eq(users.id, userId));
  logger.info({ action: 'tenant.switch', tenantId, userId }, 'Tenant alternado');
}

export async function updateTenant(
  tenantId: number,
  userId: number,
  input: {
    name?: string | undefined;
    cnpj?: string | undefined;
    phone?: string | undefined;
    email?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
  },
) {
  const updates: Partial<typeof tenants.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.cnpj !== undefined) updates.cnpj = input.cnpj;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.email !== undefined) updates.email = input.email;
  if (input.address !== undefined) updates.address = input.address;
  if (input.city !== undefined) updates.city = input.city;
  if (input.state !== undefined) updates.state = input.state;

  const [updated] = await db
    .update(tenants)
    .set(updates)
    .where(eq(tenants.id, tenantId))
    .returning();

  logger.info({ action: 'tenant.update', tenantId, userId }, 'Tenant atualizado');
  return updated;
}

export async function getTenant(tenantId: number) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  return tenant ?? null;
}

export async function deactivateTenant(tenantId: number, userId: number): Promise<void> {
  await db.update(tenants).set({ isActive: false, updatedAt: new Date() }).where(eq(tenants.id, tenantId));
  logger.info({ action: 'tenant.deactivate', tenantId, userId }, 'Tenant desativado (soft delete)');
}

// ─── Invites ─────────────────────────────────────────────────────────────────

export async function inviteMember(tenantId: number, invitedBy: number, input: { email: string; role: string }) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [invite] = await db.insert(invites).values({
    tenantId,
    email: input.email,
    role: input.role as 'gerente' | 'producao' | 'recepcao' | 'contabil' | 'superadmin',
    token,
    invitedBy,
    expiresAt,
  }).returning();

  logger.info({ action: 'tenant.invite', tenantId, email: input.email }, `Link de convite gerado (Fase 16: envio por email). Token: ${token.slice(0, 8)}...`);
  return invite;
}

export async function acceptInvite(token: string, userId: number): Promise<void> {
  const [invite] = await db.select().from(invites).where(eq(invites.token, token));

  if (!invite) {
    const { TRPCError } = await import('@trpc/server');
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Convite não encontrado' });
  }

  if (invite.status !== 'pending') {
    const { TRPCError } = await import('@trpc/server');
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Convite já foi utilizado ou expirou' });
  }

  if (invite.expiresAt < new Date()) {
    await db.update(invites).set({ status: 'expired' }).where(eq(invites.id, invite.id));
    const { TRPCError } = await import('@trpc/server');
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Convite expirado' });
  }

  await db.transaction(async (tx) => {
    // Upsert membership
    const [existing] = await tx
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, invite.tenantId), eq(tenantMembers.userId, userId)));

    if (existing) {
      await tx.update(tenantMembers).set({ isActive: true, role: invite.role, updatedAt: new Date() }).where(eq(tenantMembers.id, existing.id));
    } else {
      await tx.insert(tenantMembers).values({ tenantId: invite.tenantId, userId, role: invite.role });
      await tx.update(tenants).set({ userCount: sql`${tenants.userCount} + 1` }).where(eq(tenants.id, invite.tenantId));
    }

    await tx.update(invites).set({ status: 'accepted' }).where(eq(invites.id, invite.id));

    // Ativar tenant se user ainda não tem ativo
    const [user] = await tx.select({ activeTenantId: users.activeTenantId }).from(users).where(eq(users.id, userId));
    if (!user?.activeTenantId) {
      await tx.update(users).set({ activeTenantId: invite.tenantId }).where(eq(users.id, userId));
    }
  });

  logger.info({ action: 'tenant.invite.accepted', tenantId: invite.tenantId, userId }, 'Convite aceito');
}

export async function listInvites(tenantId: number): Promise<PendingInvite[]> {
  const rows = await db
    .select()
    .from(invites)
    .where(and(eq(invites.tenantId, tenantId), eq(invites.status, 'pending'), gt(invites.expiresAt, new Date())));

  return rows.map(r => ({
    id: r.id,
    email: r.email,
    role: r.role as Role,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function revokeInvite(tenantId: number, inviteId: number): Promise<void> {
  await db.update(invites).set({ status: 'expired' }).where(and(eq(invites.id, inviteId), eq(invites.tenantId, tenantId)));
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function listMembers(tenantId: number): Promise<TenantMember[]> {
  const rows = await db
    .select({
      id: tenantMembers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: tenantMembers.role,
      isActive: tenantMembers.isActive,
      joinedAt: tenantMembers.joinedAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(tenantMembers)
    .innerJoin(users, eq(tenantMembers.userId, users.id))
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.isActive, true)));

  return rows.map(r => ({
    ...r,
    role: r.role as Role,
    joinedAt: r.joinedAt.toISOString(),
    lastSignedIn: r.lastSignedIn?.toISOString() ?? null,
  }));
}

async function countSuperadmins(tenantId: number): Promise<number> {
  const rows = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.role, 'superadmin'), eq(tenantMembers.isActive, true)));
  return rows.length;
}

export async function updateMemberRole(tenantId: number, memberId: number, role: Role): Promise<void> {
  const [member] = await db.select().from(tenantMembers).where(and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenantId)));
  if (!member) {
    const { TRPCError } = await import('@trpc/server');
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Membro não encontrado' });
  }

  if (member.role === 'superadmin' && role !== 'superadmin') {
    const count = await countSuperadmins(tenantId);
    if (count <= 1) {
      const { TRPCError } = await import('@trpc/server');
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não é possível remover o último superadmin' });
    }
  }

  await db.update(tenantMembers).set({ role, updatedAt: new Date() }).where(eq(tenantMembers.id, memberId));
  logger.info({ action: 'tenant.member.role_changed', tenantId, memberId, role }, 'Role de membro alterado');
}

export async function removeMember(tenantId: number, memberId: number): Promise<void> {
  const [member] = await db.select().from(tenantMembers).where(and(eq(tenantMembers.id, memberId), eq(tenantMembers.tenantId, tenantId)));
  if (!member) {
    const { TRPCError } = await import('@trpc/server');
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Membro não encontrado' });
  }

  if (member.role === 'superadmin') {
    const count = await countSuperadmins(tenantId);
    if (count <= 1) {
      const { TRPCError } = await import('@trpc/server');
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não é possível remover o último superadmin' });
    }
  }

  await db.transaction(async (tx) => {
    await tx.update(tenantMembers).set({ isActive: false, updatedAt: new Date() }).where(eq(tenantMembers.id, memberId));
    await tx.update(tenants).set({ userCount: sql`${tenants.userCount} - 1` }).where(eq(tenants.id, tenantId));

    // Se user removido tinha este tenant como ativo, limpar activeTenantId
    const [u] = await tx.select({ activeTenantId: users.activeTenantId }).from(users).where(eq(users.id, member.userId));
    if (u?.activeTenantId === tenantId) {
      await tx.update(users).set({ activeTenantId: null }).where(eq(users.id, member.userId));
    }
  });

  logger.info({ action: 'tenant.member.removed', tenantId, memberId }, 'Membro removido do tenant');
}
