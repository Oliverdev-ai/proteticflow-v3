import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../db/index.js';
import { employees, payrollPeriods, payrollEntries } from '../../db/schema/index.js';
import { users } from '../../db/schema/users.js';
import { tenants } from '../../db/schema/tenants.js';
import * as payrollService from './service.js';
import { eq, and, sql } from 'drizzle-orm';

describe('Payroll Module - Phase 12', () => {
  let testTenantId: number;
  let testUserId: number;
  let testEmployeeId: number;
  let createdPeriodId: number;

  async function cleanup(tenantId: number | undefined, slug: string) {
    if (tenantId) {
      const run = (q: string) => db.execute(sql.raw(q)).catch(() => {});
      await run(`DELETE FROM payroll_entries WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM payroll_periods WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM employees WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM users WHERE active_tenant_id = ${tenantId}`);
      await run(`DELETE FROM tenants WHERE id = ${tenantId}`);
    } else {
      const [t] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug));
      if (t) await cleanup(t.id, slug);
    }
  }

  beforeAll(async () => {
    await cleanup(undefined, 'test-payroll-session');

    const [tenant] = await db.insert(tenants).values({
      name: 'Test Payroll Session',
      slug: 'test-payroll-session',
    }).returning();
    testTenantId = tenant.id;

    const [user] = await db.insert(users).values({
      activeTenantId: testTenantId,
      name: 'Admin Payroll',
      email: `admin-payroll-${Date.now()}@test.com`,
      passwordHash: 'hashed',
      role: 'admin' as any,
    }).returning();
    testUserId = user.id;

    const [employee] = await db.insert(employees).values({
      tenantId: testTenantId,
      name: 'Payroll Staff',
      type: 'protesista' as any,
      contractType: 'clt' as any,
      isActive: true,
      baseSalaryCents: 300000,
      createdBy: testUserId,
    }).returning();
    testEmployeeId = employee.id;
  });

  afterAll(async () => {
    await cleanup(testTenantId, 'test-payroll-session');
  });

  it('1. Should create a payroll period', async () => {
    const period = await payrollService.createPeriod(testTenantId, 2024, 3);
    expect(period.id).toBeDefined();
    expect(period.month).toBe(3);
    createdPeriodId = period.id;
  });

  it('2. Should list payroll periods', async () => {
    const periods = await payrollService.listPeriods(testTenantId);
    expect(periods.length).toBeGreaterThan(0);
    expect(periods[0].id).toBe(createdPeriodId);
  });

  it('3. Should generate entries for active employees', async () => {
    const entries = await payrollService.generateEntries(testTenantId, createdPeriodId);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].employeeId).toBe(testEmployeeId);
    expect(entries[0].baseSalaryCents).toBe(300000);
  });

  it('4. Should close payroll period', async () => {
    const updated = await payrollService.closePeriod(testTenantId, createdPeriodId, testUserId);
    expect(updated?.status).toBe('closed');
    expect(updated?.totalGrossCents).toBeGreaterThan(0);
  });
});
