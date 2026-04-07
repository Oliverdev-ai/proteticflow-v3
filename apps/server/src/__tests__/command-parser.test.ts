import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { hashPassword } from '../core/auth.js';
import { clients } from '../db/schema/clients.js';
import { tenantMembers, tenants } from '../db/schema/tenants.js';
import { users } from '../db/schema/users.js';
import {
  FLOW_COMMANDS,
  checkCommandAccess,
  parseIntent,
  resolveAction,
  resolveEntities,
} from '../modules/ai/command-parser.js';

type SeedRefs = {
  userIds: number[];
  tenantIds: number[];
  clientIds: number[];
};

const refs: SeedRefs = {
  userIds: [],
  tenantIds: [],
  clientIds: [],
};

async function createTenantWithMember(prefix: string, role: 'superadmin' | 'gerente' | 'producao' = 'gerente') {
  const [user] = await db
    .insert(users)
    .values({
      name: `User ${prefix}`,
      email: `${prefix}-${Date.now()}@test.com`,
      passwordHash: await hashPassword('Test123!'),
      role: 'user',
    })
    .returning();
  refs.userIds.push(user!.id);

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: `Tenant ${prefix}`,
      slug: `tenant-${prefix}-${Date.now()}`,
    })
    .returning();
  refs.tenantIds.push(tenant!.id);

  await db.insert(tenantMembers).values({
    tenantId: tenant!.id,
    userId: user!.id,
    role,
  });

  return { tenantId: tenant!.id, userId: user!.id };
}

async function cleanup() {
  if (refs.clientIds.length > 0) {
    await db.delete(clients).where(inArray(clients.id, refs.clientIds));
  }
  if (refs.tenantIds.length > 0) {
    await db.delete(tenantMembers).where(inArray(tenantMembers.tenantId, refs.tenantIds));
    await db.delete(tenants).where(inArray(tenants.id, refs.tenantIds));
  }
  if (refs.userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, refs.userIds));
  }

  refs.userIds = [];
  refs.tenantIds = [];
  refs.clientIds = [];
}

describe('F38 O1 - command parser', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. identifica intent para input simples', async () => {
    const parsed = await parseIntent('mostrar trabalhos pendentes', 1);
    expect(parsed.intent).toBe('jobs.listPending');
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('2. retorna confidence baixa para input ambiguo', async () => {
    const parsed = await parseIntent('me ajuda com isso', 1);
    expect(parsed.intent).toBeNull();
    expect(parsed.confidence).toBeLessThan(0.7);
  });

  it('3. registry expoe roles corretas por comando', () => {
    expect(FLOW_COMMANDS['jobs.suspend'].roles).toContain('gerente');
    expect(FLOW_COMMANDS['jobs.suspend'].roles).not.toContain('producao');
  });

  it('4. risk engine classifica os quatro niveis', () => {
    expect(resolveAction('read_only')).toBe('execute');
    expect(resolveAction('assistive')).toBe('execute');
    expect(resolveAction('transactional')).toBe('review');
    expect(resolveAction('critical')).toBe('confirm');
  });

  it('5. resolve entidade com match unico', async () => {
    const { tenantId } = await createTenantWithMember('f38-resolve-one');
    const [createdClient] = await db
      .insert(clients)
      .values({ tenantId, name: 'Dr Alice Unica' })
      .returning();
    refs.clientIds.push(createdClient!.id);

    const resolved = await resolveEntities({ clientName: 'Alice Unica' }, tenantId);
    expect(resolved.clientName?.status).toBe('resolved');
  });

  it('6. resolve entidade com ambiguidades e candidatos', async () => {
    const { tenantId } = await createTenantWithMember('f38-resolve-many');
    const inserted = await db
      .insert(clients)
      .values([
        { tenantId, name: 'Dr Bruno Alves' },
        { tenantId, name: 'Dr Bruno Souza' },
      ])
      .returning();
    refs.clientIds.push(...inserted.map((item) => item.id));

    const resolved = await resolveEntities({ clientName: 'Bruno' }, tenantId);
    expect(resolved.clientName?.status).toBe('ambiguous');
    if (resolved.clientName?.status === 'ambiguous') {
      expect(resolved.clientName.candidates.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('7. resolve entidade sem match retorna not_found', async () => {
    const { tenantId } = await createTenantWithMember('f38-not-found');
    const resolved = await resolveEntities({ clientName: 'Nome Inexistente XYZ' }, tenantId);
    expect(resolved.clientName?.status).toBe('not_found');
  });

  it('8. RBAC bloqueia operador em comando critico', () => {
    const canAccess = checkCommandAccess('financial.monthlyClosing', 'producao');
    expect(canAccess).toBe(false);
  });

  it('9. RBAC permite superadmin em todos os comandos', () => {
    const allAllowed = Object.keys(FLOW_COMMANDS).every((command) =>
      checkCommandAccess(command as keyof typeof FLOW_COMMANDS, 'superadmin'));
    expect(allAllowed).toBe(true);
  });

  it('10. tenant isolation no entity resolver', async () => {
    const tenantA = await createTenantWithMember('f38-tenant-a');
    const tenantB = await createTenantWithMember('f38-tenant-b');

    const [createdClient] = await db
      .insert(clients)
      .values({ tenantId: tenantA.tenantId, name: 'Dr Isolado Tenant A' })
      .returning();
    refs.clientIds.push(createdClient!.id);

    const sameTenant = await resolveEntities({ clientName: 'Isolado Tenant A' }, tenantA.tenantId);
    const otherTenant = await resolveEntities({ clientName: 'Isolado Tenant A' }, tenantB.tenantId);

    expect(sameTenant.clientName?.status).toBe('resolved');
    expect(otherTenant.clientName?.status).toBe('not_found');

    const [dbCheck] = await db
      .select({ tenantId: clients.tenantId })
      .from(clients)
      .where(and(eq(clients.id, createdClient!.id), eq(clients.tenantId, tenantA.tenantId)));
    expect(dbCheck?.tenantId).toBe(tenantA.tenantId);
  });
});
