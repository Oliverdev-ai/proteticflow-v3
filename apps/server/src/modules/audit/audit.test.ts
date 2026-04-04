import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, tenants, tenantMembers } from '../../db/schema/index.js';
import { auditLogs } from '../../db/schema/audit.js';
import { hashPassword } from '../../core/auth.js';
import {
  blockMember,
  getTenantUsageSummary,
  listAuditLogs,
  logAudit,
  unblockMember,
} from './service.js';

async function createTestUser(email: string) {
  const [user] = await db.insert(users).values({
    name: 'Audit Test',
    email,
    passwordHash: await hashPassword('Test123!'),
    role: 'user',
  }).returning();

  return user!;
}

async function createTestTenant(userId: number, name: string) {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;

  const [tenant] = await db
    .insert(tenants)
    .values({
      name,
      slug,
      plan: 'trial',
      userCount: 1,
    })
    .returning();

  await db.insert(tenantMembers).values({
    tenantId: tenant!.id,
    userId,
    role: 'superadmin',
  });

  await db
    .update(users)
    .set({ activeTenantId: tenant!.id })
    .where(eq(users.id, userId));

  return tenant!;
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.delete(auditLogs);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

async function ensureAuditSchema() {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'admin');
      END IF;
    END $$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier') THEN
        CREATE TYPE plan_tier AS ENUM ('trial', 'starter', 'pro', 'enterprise');
      END IF;
    END $$;
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_member_role') THEN
        CREATE TYPE tenant_member_role AS ENUM ('superadmin', 'gerente', 'producao', 'recepcao', 'contabil');
      END IF;
    END $$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY,
      name varchar(255) NOT NULL,
      email varchar(320) NOT NULL UNIQUE,
      phone varchar(32),
      avatar_url text,
      password_hash varchar(255) NOT NULL,
      two_factor_secret varchar(128),
      two_factor_enabled boolean NOT NULL DEFAULT false,
      role user_role NOT NULL DEFAULT 'user',
      active_tenant_id integer,
      is_active boolean NOT NULL DEFAULT true,
      last_signed_in timestamp with time zone,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone varchar(32)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret varchar(128)`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_tenant_id integer`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_signed_in timestamp with time zone`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now()`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now()`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id serial PRIMARY KEY,
      name varchar(255) NOT NULL,
      slug varchar(128) NOT NULL UNIQUE,
      plan plan_tier NOT NULL DEFAULT 'trial',
      plan_expires_at timestamp with time zone,
      logo_url text,
      cnpj varchar(18),
      phone varchar(32),
      email varchar(320),
      address text,
      city varchar(128),
      state varchar(2),
      is_active boolean NOT NULL DEFAULT true,
      parent_tenant_id integer,
      client_count integer NOT NULL DEFAULT 0,
      job_count_this_month integer NOT NULL DEFAULT 0,
      user_count integer NOT NULL DEFAULT 0,
      price_table_count integer NOT NULL DEFAULT 0,
      storage_used_mb integer NOT NULL DEFAULT 0,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url text`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cnpj varchar(18)`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone varchar(32)`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email varchar(320)`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address text`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS city varchar(128)`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS state varchar(2)`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_expires_at timestamp with time zone`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS parent_tenant_id integer`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS client_count integer NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS job_count_this_month integer NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS user_count integer NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS price_table_count integer NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS storage_used_mb integer NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now()`);
  await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now()`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenant_members (
      id serial PRIMARY KEY,
      tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id integer NOT NULL,
      role tenant_member_role NOT NULL DEFAULT 'recepcao',
      is_active boolean NOT NULL DEFAULT true,
      blocked_at timestamp with time zone,
      blocked_reason text,
      blocked_by integer,
      joined_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      CONSTRAINT tm_tenant_user_unique UNIQUE (tenant_id, user_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id serial PRIMARY KEY,
      tenant_id integer NOT NULL,
      user_id integer NOT NULL,
      action varchar(128) NOT NULL,
      entity_type varchar(64) NOT NULL,
      entity_id integer,
      old_value jsonb,
      new_value jsonb,
      ip_address varchar(45),
      user_agent text,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS blocked_at timestamp with time zone`);
  await db.execute(sql`ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS blocked_reason text`);
  await db.execute(sql`ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS blocked_by integer`);
}

describe('Audit Service', () => {
  beforeEach(async () => {
    await ensureAuditSchema();
    await cleanup();
  });
  afterEach(cleanup);

  it('T01: logAudit registra evento corretamente', async () => {
    const user = await createTestUser('audit-t01@test.com');
    const tenant = await createTestTenant(user.id, 'Lab T01');

    await logAudit({
      tenantId: tenant.id,
      userId: user.id,
      action: 'job.create',
      entityType: 'jobs',
      entityId: 99,
      newValue: { code: 'OS-00099' },
    });

    const result = await listAuditLogs(tenant.id, {});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.action).toBe('job.create');
    expect(result.items[0]?.entityId).toBe(99);
  });

  it('T02: logAudit com oldValue/newValue persiste JSONB', async () => {
    const user = await createTestUser('audit-t02@test.com');
    const tenant = await createTestTenant(user.id, 'Lab T02');

    await logAudit({
      tenantId: tenant.id,
      userId: user.id,
      action: 'client.update',
      entityType: 'clients',
      entityId: 42,
      oldValue: { name: 'Antigo' },
      newValue: { name: 'Novo' },
    });

    const result = await listAuditLogs(tenant.id, {});
    const oldValue = result.items[0]?.oldValue as Record<string, unknown>;
    const newValue = result.items[0]?.newValue as Record<string, unknown>;
    expect(oldValue.name).toBe('Antigo');
    expect(newValue.name).toBe('Novo');
  });

  it('T03: listAuditLogs filtra por tenantId (isolamento)', async () => {
    const userA = await createTestUser('audit-t03a@test.com');
    const userB = await createTestUser('audit-t03b@test.com');
    const tenantA = await createTestTenant(userA.id, 'Lab T03A');
    const tenantB = await createTestTenant(userB.id, 'Lab T03B');

    await logAudit({ tenantId: tenantA.id, userId: userA.id, action: 'job.create', entityType: 'jobs' });
    await logAudit({ tenantId: tenantB.id, userId: userB.id, action: 'job.create', entityType: 'jobs' });

    const result = await listAuditLogs(tenantA.id, {});
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.tenantId).toBe(tenantA.id);
  });

  it('T04: listAuditLogs filtra por entityType e action', async () => {
    const user = await createTestUser('audit-t04@test.com');
    const tenant = await createTestTenant(user.id, 'Lab T04');

    await logAudit({ tenantId: tenant.id, userId: user.id, action: 'job.create', entityType: 'jobs' });
    await logAudit({ tenantId: tenant.id, userId: user.id, action: 'client.create', entityType: 'clients' });

    const result = await listAuditLogs(tenant.id, { entityType: 'jobs', action: 'job.create' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.entityType).toBe('jobs');
    expect(result.items[0]?.action).toBe('job.create');
  });

  it('T05: blockMember marca usuário como bloqueado', async () => {
    const user = await createTestUser('audit-t05@test.com');
    const tenant = await createTestTenant(user.id, 'Lab T05');

    await blockMember(tenant.id, user.id, user.id, 'Teste bloqueio');

    const [member] = await db
      .select({
        blockedAt: tenantMembers.blockedAt,
        blockedReason: tenantMembers.blockedReason,
      })
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.userId, user.id)))
      .limit(1);

    expect(member?.blockedAt).not.toBeNull();
    expect(member?.blockedReason).toBe('Teste bloqueio');
  });

  it('T06: unblockMember remove bloqueio', async () => {
    const user = await createTestUser('audit-t06@test.com');
    const tenant = await createTestTenant(user.id, 'Lab T06');

    await blockMember(tenant.id, user.id, user.id, 'Teste');
    await unblockMember(tenant.id, user.id);

    const [member] = await db
      .select({
        blockedAt: tenantMembers.blockedAt,
        blockedReason: tenantMembers.blockedReason,
      })
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.userId, user.id)))
      .limit(1);

    expect(member?.blockedAt).toBeNull();
    expect(member?.blockedReason).toBeNull();
  });

  it('T07: getTenantUsageSummary retorna contadores reais', async () => {
    const user = await createTestUser('audit-t07@test.com');
    const tenant = await createTestTenant(user.id, 'Lab T07');

    const summary = await getTenantUsageSummary(tenant.id);
    expect(summary).not.toBeNull();
    expect(summary?.plan).toBe('trial');
    expect(summary?.clients.used).toBeGreaterThanOrEqual(0);
    expect(summary?.jobsThisMonth.used).toBeGreaterThanOrEqual(0);
  });

  it('T08: listAuditLogs respeita paginação offset', async () => {
    const user = await createTestUser('audit-t08@test.com');
    const tenant = await createTestTenant(user.id, 'Lab T08');

    for (let index = 0; index < 5; index += 1) {
      await logAudit({
        tenantId: tenant.id,
        userId: user.id,
        action: `action.${index}`,
        entityType: 'test',
      });
    }

    const page1 = await listAuditLogs(tenant.id, { page: 1, limit: 2 });
    const page3 = await listAuditLogs(tenant.id, { page: 3, limit: 2 });

    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page3.items).toHaveLength(1);
  });
});
