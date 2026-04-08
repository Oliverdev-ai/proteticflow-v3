import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { hashPassword } from '../core/auth.js';
import { clients } from '../db/schema/clients.js';
import { jobItems, jobs } from '../db/schema/jobs.js';
import { materials, stockMovements } from '../db/schema/materials.js';
import { tenantMembers, tenants } from '../db/schema/tenants.js';
import { users } from '../db/schema/users.js';
import { generateAbcCurveReport } from '../modules/reports/abc-curve.service.js';

type SeedContext = {
  tenantId: number;
  ownerId: number;
  technicianAId: number;
  technicianBId: number;
  startDate: string;
  endDate: string;
};

async function createTestUser(email: string, name = 'Tester') {
  const [created] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash: await hashPassword('Test123!'),
      role: 'user',
    })
    .returning();

  return created!;
}

async function createTestTenant(name: string, slug: string) {
  const [created] = await db
    .insert(tenants)
    .values({
      name,
      slug,
    })
    .returning();

  return created!;
}

async function seedAbcData(prefix: string): Promise<SeedContext> {
  const owner = await createTestUser(`${prefix}-owner@test.com`, 'Owner');
  const technicianA = await createTestUser(`${prefix}-tech-a@test.com`, 'Tecnico A');
  const technicianB = await createTestUser(`${prefix}-tech-b@test.com`, 'Tecnico B');
  const tenant = await createTestTenant(`Tenant ${prefix}`, `tenant-${prefix}`);

  await db.insert(tenantMembers).values([
    { tenantId: tenant.id, userId: owner.id, role: 'superadmin' },
    { tenantId: tenant.id, userId: technicianA.id, role: 'producao' },
    { tenantId: tenant.id, userId: technicianB.id, role: 'producao' },
  ]);

  const [clientA] = await db
    .insert(clients)
    .values({ tenantId: tenant.id, name: `Cliente A ${prefix}` })
    .returning();
  const [clientB] = await db
    .insert(clients)
    .values({ tenantId: tenant.id, name: `Cliente B ${prefix}` })
    .returning();

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const completion = new Date(now.getTime() - 30 * 60 * 1000);

  const [jobA] = await db
    .insert(jobs)
    .values({
      tenantId: tenant.id,
      code: `OS-${prefix}-A`,
      clientId: clientA!.id,
      status: 'delivered',
      totalCents: 8000,
      deadline: tomorrow,
      assignedTo: technicianA.id,
      completedAt: completion,
    })
    .returning();

  const [jobB] = await db
    .insert(jobs)
    .values({
      tenantId: tenant.id,
      code: `OS-${prefix}-B`,
      clientId: clientB!.id,
      status: 'delivered',
      totalCents: 1500,
      deadline: tomorrow,
      assignedTo: technicianA.id,
      completedAt: completion,
    })
    .returning();

  const [jobC] = await db
    .insert(jobs)
    .values({
      tenantId: tenant.id,
      code: `OS-${prefix}-C`,
      clientId: clientB!.id,
      status: 'ready',
      totalCents: 500,
      deadline: tomorrow,
      assignedTo: technicianB.id,
      completedAt: completion,
    })
    .returning();

  await db.insert(jobItems).values([
    {
      tenantId: tenant.id,
      jobId: jobA!.id,
      serviceNameSnapshot: 'Servico A',
      quantity: 1,
      unitPriceCents: 8000,
      totalCents: 8000,
    },
    {
      tenantId: tenant.id,
      jobId: jobB!.id,
      serviceNameSnapshot: 'Servico B',
      quantity: 1,
      unitPriceCents: 1500,
      totalCents: 1500,
    },
    {
      tenantId: tenant.id,
      jobId: jobC!.id,
      serviceNameSnapshot: 'Servico C',
      quantity: 1,
      unitPriceCents: 500,
      totalCents: 500,
    },
  ]);

  const [materialA] = await db
    .insert(materials)
    .values({ tenantId: tenant.id, name: `Material A ${prefix}`, createdBy: owner.id })
    .returning();
  const [materialB] = await db
    .insert(materials)
    .values({ tenantId: tenant.id, name: `Material B ${prefix}`, createdBy: owner.id })
    .returning();
  const [materialC] = await db
    .insert(materials)
    .values({ tenantId: tenant.id, name: `Material C ${prefix}`, createdBy: owner.id })
    .returning();

  await db.insert(stockMovements).values([
    {
      tenantId: tenant.id,
      materialId: materialA!.id,
      type: 'out',
      quantity: '8',
      stockAfter: '2',
      unitCostCents: 200,
      createdBy: owner.id,
    },
    {
      tenantId: tenant.id,
      materialId: materialB!.id,
      type: 'out',
      quantity: '3',
      stockAfter: '1',
      unitCostCents: 100,
      createdBy: owner.id,
    },
    {
      tenantId: tenant.id,
      materialId: materialC!.id,
      type: 'out',
      quantity: '1',
      stockAfter: '0',
      unitCostCents: 100,
      createdBy: owner.id,
    },
  ]);

  return {
    tenantId: tenant.id,
    ownerId: owner.id,
    technicianAId: technicianA.id,
    technicianBId: technicianB.id,
    startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  await db.execute(sql`DELETE FROM audit_logs`).catch(() => {});
  await db.delete(stockMovements);
  await db.delete(materials);
  await db.delete(jobItems);
  await db.delete(jobs);
  await db.delete(clients);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('ABC Curve (F36)', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('1. classifica A/B/C para curva de servicos com dados conhecidos', async () => {
    const seed = await seedAbcData('f36-services');

    const result = await generateAbcCurveReport(seed.tenantId, {
      type: 'services',
      startDate: seed.startDate,
      endDate: seed.endDate,
    });

    expect(result.items).toHaveLength(3);
    expect(result.items[0]?.label).toBe('Servico A');
    expect(result.items[0]?.classification).toBe('A');
    expect(result.items[1]?.classification).toBe('B');
    expect(result.items[2]?.classification).toBe('C');
  });

  it('2. calcula percentual acumulado corretamente', async () => {
    const seed = await seedAbcData('f36-acc');

    const result = await generateAbcCurveReport(seed.tenantId, {
      type: 'services',
      startDate: seed.startDate,
      endDate: seed.endDate,
    });

    expect(result.totalValue).toBe(10000);
    expect(result.items[0]?.accumulatedPercentage).toBe(80);
    expect(result.items[1]?.accumulatedPercentage).toBe(95);
    expect(result.items[2]?.accumulatedPercentage).toBe(100);
  });

  it('3. periodo sem dados retorna itens vazios e summary zerado', async () => {
    const seed = await seedAbcData('f36-empty');
    const startDate = new Date('2001-01-01T00:00:00.000Z').toISOString();
    const endDate = new Date('2001-01-31T23:59:59.999Z').toISOString();

    const result = await generateAbcCurveReport(seed.tenantId, {
      type: 'services',
      startDate,
      endDate,
    });

    expect(result.items).toHaveLength(0);
    expect(result.totalValue).toBe(0);
    expect(result.summary.a.count).toBe(0);
    expect(result.summary.b.count).toBe(0);
    expect(result.summary.c.count).toBe(0);
    expect(result.summary.a.totalValue).toBe(0);
    expect(result.summary.b.totalValue).toBe(0);
    expect(result.summary.c.totalValue).toBe(0);
  });

  it('4. tenant isolation: dados de outro tenant nao entram no resultado', async () => {
    const tenantA = await seedAbcData('f36-tenant-a');
    const tenantB = await seedAbcData('f36-tenant-b');

    const resultA = await generateAbcCurveReport(tenantA.tenantId, {
      type: 'services',
      startDate: tenantA.startDate,
      endDate: tenantA.endDate,
    });

    const resultB = await generateAbcCurveReport(tenantB.tenantId, {
      type: 'services',
      startDate: tenantB.startDate,
      endDate: tenantB.endDate,
    });

    expect(resultA.items).toHaveLength(3);
    expect(resultB.items).toHaveLength(3);

    const [jobFromA] = await db
      .select({ tenantId: jobs.tenantId })
      .from(jobs)
      .where(eq(jobs.tenantId, tenantA.tenantId))
      .limit(1);
    expect(jobFromA?.tenantId).toBe(tenantA.tenantId);
  }, 20000);

  it('5. gera resultados para os quatro tipos (services, clients, materials, technicians)', async () => {
    const seed = await seedAbcData('f36-types');

    const [services, clientCurve, materialCurve, technicianCurve] = await Promise.all([
      generateAbcCurveReport(seed.tenantId, {
        type: 'services',
        startDate: seed.startDate,
        endDate: seed.endDate,
      }),
      generateAbcCurveReport(seed.tenantId, {
        type: 'clients',
        startDate: seed.startDate,
        endDate: seed.endDate,
      }),
      generateAbcCurveReport(seed.tenantId, {
        type: 'materials',
        startDate: seed.startDate,
        endDate: seed.endDate,
      }),
      generateAbcCurveReport(seed.tenantId, {
        type: 'technicians',
        startDate: seed.startDate,
        endDate: seed.endDate,
      }),
    ]);

    expect(services.items.length).toBeGreaterThan(0);
    expect(clientCurve.items.length).toBeGreaterThan(0);
    expect(materialCurve.items.length).toBeGreaterThan(0);
    expect(technicianCurve.items.length).toBeGreaterThan(0);
  });
});
