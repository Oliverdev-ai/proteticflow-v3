import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { hashPassword } from '../core/auth.js';
import { clients } from '../db/schema/clients.js';
import { accountsPayable } from '../db/schema/financials.js';
import { fiscalSettings } from '../db/schema/fiscal.js';
import { jobItems, jobs } from '../db/schema/jobs.js';
import { suppliers } from '../db/schema/materials.js';
import { tenantMembers, tenants } from '../db/schema/tenants.js';
import { users } from '../db/schema/users.js';
import {
  exportFiscalCsv,
  exportFiscalPdf,
  getFiscalDreReport,
  getFiscalExpensesReport,
  getFiscalRevenueReport,
} from '../modules/reports/fiscal.service.js';

type SeedContext = {
  tenantId: number;
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
    .values({ name, slug })
    .returning();

  return created!;
}

async function seedFiscalData(prefix: string, multiplier = 1): Promise<SeedContext> {
  const owner = await createTestUser(`${prefix}-owner@test.com`, `Owner ${prefix}`);
  const tenant = await createTestTenant(`Tenant ${prefix}`, `tenant-${prefix}`);

  await db.insert(tenantMembers).values({
    tenantId: tenant.id,
    userId: owner.id,
    role: 'superadmin',
  });

  const [clientA] = await db
    .insert(clients)
    .values({ tenantId: tenant.id, name: `Dentista A ${prefix}` })
    .returning();
  const [clientB] = await db
    .insert(clients)
    .values({ tenantId: tenant.id, name: `Dentista B ${prefix}` })
    .returning();

  const [supplierA] = await db
    .insert(suppliers)
    .values({ tenantId: tenant.id, name: `Fornecedor A ${prefix}` })
    .returning();
  const [supplierB] = await db
    .insert(suppliers)
    .values({ tenantId: tenant.id, name: `Fornecedor B ${prefix}` })
    .returning();

  await db.insert(fiscalSettings).values({
    tenantId: tenant.id,
    defaultServiceCode: '0401',
    defaultServiceName: 'Protese',
    issqnRatePercent: '10.00',
  });

  const januaryCompletedAt = new Date('2026-01-15T10:00:00.000Z');
  const februaryCompletedAt = new Date('2026-02-10T10:00:00.000Z');
  const deadline = new Date('2026-02-28T12:00:00.000Z');

  const [jobA] = await db
    .insert(jobs)
    .values({
      tenantId: tenant.id,
      code: `OS-${prefix}-A`,
      clientId: clientA!.id,
      status: 'ready',
      totalCents: 10000 * multiplier,
      deadline,
      completedAt: januaryCompletedAt,
    })
    .returning();

  const [jobB] = await db
    .insert(jobs)
    .values({
      tenantId: tenant.id,
      code: `OS-${prefix}-B`,
      clientId: clientB!.id,
      status: 'delivered',
      totalCents: 5000 * multiplier,
      deadline,
      completedAt: februaryCompletedAt,
    })
    .returning();

  await db.insert(jobs).values({
    tenantId: tenant.id,
    code: `OS-${prefix}-CANCELLED`,
    clientId: clientB!.id,
    status: 'cancelled',
    totalCents: 9000 * multiplier,
    deadline,
    completedAt: januaryCompletedAt,
  });

  await db.insert(jobs).values({
    tenantId: tenant.id,
    code: `OS-${prefix}-DELETED`,
    clientId: clientA!.id,
    status: 'ready',
    totalCents: 12000 * multiplier,
    deadline,
    completedAt: januaryCompletedAt,
    deletedAt: new Date('2026-01-20T00:00:00.000Z'),
  });

  await db.insert(jobItems).values([
    {
      tenantId: tenant.id,
      jobId: jobA!.id,
      serviceNameSnapshot: 'Coroa',
      quantity: 1,
      unitPriceCents: 10000 * multiplier,
      totalCents: 10000 * multiplier,
    },
    {
      tenantId: tenant.id,
      jobId: jobB!.id,
      serviceNameSnapshot: 'Protocolo',
      quantity: 1,
      unitPriceCents: 5000 * multiplier,
      totalCents: 5000 * multiplier,
    },
  ]);

  await db.insert(accountsPayable).values([
    {
      tenantId: tenant.id,
      description: 'Resina',
      supplierId: supplierA!.id,
      supplier: supplierA!.name,
      category: 'Materiais',
      amountCents: 3000 * multiplier,
      dueDate: new Date('2026-01-20T00:00:00.000Z'),
      paidAt: new Date('2026-01-25T00:00:00.000Z'),
      status: 'paid',
    },
    {
      tenantId: tenant.id,
      description: 'Frete',
      supplierId: supplierB!.id,
      supplier: supplierB!.name,
      category: 'Logistica',
      amountCents: 2000 * multiplier,
      dueDate: new Date('2026-02-20T00:00:00.000Z'),
      paidAt: new Date('2026-02-25T00:00:00.000Z'),
      status: 'paid',
    },
    {
      tenantId: tenant.id,
      description: 'Conta em aberto',
      supplier: 'Fornecedor Pendente',
      category: 'Outros',
      amountCents: 1000 * multiplier,
      dueDate: new Date('2026-02-25T00:00:00.000Z'),
      status: 'pending',
    },
  ]);

  return {
    tenantId: tenant.id,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-02-28T23:59:59.999Z',
  };
}

async function cleanup() {
  await db.execute(sql`DELETE FROM feature_usage_logs`).catch(() => {});
  await db.execute(sql`DELETE FROM license_checks`).catch(() => {});
  await db.execute(sql`DELETE FROM audit_logs`).catch(() => {});
  await db.delete(jobItems);
  await db.delete(jobs);
  await db.delete(accountsPayable);
  await db.delete(clients);
  await db.delete(suppliers);
  await db.delete(fiscalSettings);
  await db.delete(tenantMembers);
  await db.delete(tenants);
  await db.delete(users);
}

describe('Fiscal Reports (F37)', () => {
  beforeEach(cleanup, 30000);
  afterEach(cleanup, 30000);

  it('1. faturamento com dados conhecidos retorna total correto', async () => {
    const seed = await seedFiscalData('f37-revenue');

    const result = await getFiscalRevenueReport(seed.tenantId, {
      startDate: seed.startDate,
      endDate: seed.endDate,
    });

    expect(result.totalCents).toBe(15000);
    expect(result.byMonth).toHaveLength(2);
    expect(result.byClient[0]?.totalCents).toBe(10000);
  }, 20000);

  it('2. faturamento em periodo sem dados retorna total zero', async () => {
    const seed = await seedFiscalData('f37-empty');

    const result = await getFiscalRevenueReport(seed.tenantId, {
      startDate: '2000-01-01T00:00:00.000Z',
      endDate: '2000-01-31T23:59:59.999Z',
    });

    expect(result.totalCents).toBe(0);
    expect(result.byMonth).toHaveLength(0);
    expect(result.byClient).toHaveLength(0);
  }, 20000);

  it('3. despesas agrupadas por fornecedor retornam totais corretos', async () => {
    const seed = await seedFiscalData('f37-expenses');

    const result = await getFiscalExpensesReport(seed.tenantId, {
      startDate: seed.startDate,
      endDate: seed.endDate,
    });

    expect(result.totalCents).toBe(5000);
    expect(result.bySupplier).toHaveLength(2);
    expect(result.bySupplier[0]?.totalCents).toBe(3000);
    expect(result.byCategory.find((item) => item.label === 'Materiais')?.totalCents).toBe(3000);
  }, 20000);

  it('4. DRE calcula resultado operacional e liquido', async () => {
    const seed = await seedFiscalData('f37-dre');

    const result = await getFiscalDreReport(seed.tenantId, {
      startDate: seed.startDate,
      endDate: seed.endDate,
    });

    expect(result.grossRevenueCents).toBe(15000);
    expect(result.operatingExpensesCents).toBe(5000);
    expect(result.operatingResultCents).toBe(10000);
    expect(result.taxRatePercent).toBe(10);
    expect(result.taxesCents).toBe(1000);
    expect(result.netResultCents).toBe(9000);
  }, 20000);

  it('5. CSV e gerado com BOM UTF-8 e separador ponto e virgula', async () => {
    const seed = await seedFiscalData('f37-csv');

    const artifact = await exportFiscalCsv(seed.tenantId, {
      reportId: 'fiscal-revenue',
      startDate: seed.startDate,
      endDate: seed.endDate,
    });

    const csvText = Buffer.from(artifact.base64, 'base64').toString('utf-8');
    expect(csvText.charCodeAt(0)).toBe(0xfeff);
    expect(csvText).toContain(';');
    expect(csvText).toContain('Relatorio;Faturamento por Periodo');
  }, 20000);

  it('6. PDF e gerado sem erro e retorna buffer nao vazio', async () => {
    const seed = await seedFiscalData('f37-pdf');

    const artifact = await exportFiscalPdf(seed.tenantId, {
      reportId: 'fiscal-dre',
      startDate: seed.startDate,
      endDate: seed.endDate,
    });

    const pdfBuffer = Buffer.from(artifact.base64, 'base64');
    expect(artifact.mimeType).toBe('application/pdf');
    expect(pdfBuffer.byteLength).toBeGreaterThan(1000);
  }, 25000);

  it('7. tenant isolation em faturamento e despesas', async () => {
    const tenantA = await seedFiscalData('f37-tenant-a');
    await seedFiscalData('f37-tenant-b', 10);

    const revenueA = await getFiscalRevenueReport(tenantA.tenantId, {
      startDate: tenantA.startDate,
      endDate: tenantA.endDate,
    });
    const expensesA = await getFiscalExpensesReport(tenantA.tenantId, {
      startDate: tenantA.startDate,
      endDate: tenantA.endDate,
    });

    expect(revenueA.totalCents).toBe(15000);
    expect(expensesA.totalCents).toBe(5000);
  }, 30000);

  it('8. soft delete em jobs e respeitado no faturamento', async () => {
    const seed = await seedFiscalData('f37-soft-delete');

    const [deletedJob] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.tenantId, seed.tenantId), eq(jobs.code, 'OS-f37-soft-delete-DELETED')))
      .limit(1);

    expect(deletedJob).toBeTruthy();

    const result = await getFiscalRevenueReport(seed.tenantId, {
      startDate: seed.startDate,
      endDate: seed.endDate,
    });

    expect(result.totalCents).toBe(15000);
  }, 20000);
});
