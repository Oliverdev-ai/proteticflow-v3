import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../db/index.js';
import { employees, payrollPeriods, payrollEntries, jobAssignments, jobs, clients } from '../../db/schema/index.js';
import { users } from '../../db/schema/users.js';
import { tenants } from '../../db/schema/tenants.js';
import * as payrollService from './service.js';
import { eq, and, sql } from 'drizzle-orm';

function assertExists<T>(value: T | undefined, label: string): T {
  if (!value) throw new Error(`${label} not found`);
  return value;
}

describe('Payroll Module - Phase 12 (Full 10 Tests)', () => {
  let testTenantId: number;
  let testUserId: number;
  let testEmployeeId: number;
  let createdPeriodId: number;

  async function cleanup(tenantId: number | undefined, slug: string) {
    if (tenantId) {
      const run = (q: string) => db.execute(sql.raw(q)).catch(() => {});
      await run(`DELETE FROM payroll_entries WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM payroll_periods WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM job_assignments WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM jobs WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM clients WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM employees WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM users WHERE active_tenant_id = ${tenantId}`);
      await run(`DELETE FROM tenants WHERE id = ${tenantId}`);
    } else {
      const [t] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug));
      if (t) await cleanup(t.id, slug);
    }
  }

  beforeAll(async () => {
    await cleanup(undefined, 'test-payroll-p12');

    const [tenantRow] = await db
      .insert(tenants)
      .values({ name: 'Payroll Phase 12', slug: 'test-payroll-p12' })
      .returning();
    const tenant = assertExists(tenantRow, 'payroll tenant');
    testTenantId = tenant.id;

    const [userRow] = await db
      .insert(users)
      .values({
        activeTenantId: testTenantId,
        name: 'Admin Payroll',
        email: `admin-pay-${Date.now()}@test.com`,
        passwordHash: 'hashed',
        role: 'admin',
      })
      .returning();
    const user = assertExists(userRow, 'payroll user');
    testUserId = user.id;

    const [employeeRow] = await db
      .insert(employees)
      .values({
        tenantId: testTenantId,
        name: 'Salary Staff',
        type: 'protesista',
        contractType: 'clt',
        isActive: true,
        baseSalaryCents: 300000,
        createdBy: testUserId,
        defaultCommissionPercent: '10.00',
      })
      .returning();
    const employee = assertExists(employeeRow, 'payroll employee');
    testEmployeeId = employee.id;

    const [clientRow] = await db
      .insert(clients)
      .values({ tenantId: testTenantId, name: 'Payroll Clinic' })
      .returning();
    const client = assertExists(clientRow, 'payroll client');

    const [jobRow] = await db
      .insert(jobs)
      .values({
        tenantId: testTenantId,
        clientId: client.id,
        code: 'PAY-JOB',
        status: 'delivered',
        completedAt: new Date(2024, 2, 15),
        deadline: new Date(),
        totalCents: 100000,
      })
      .returning();
    const job = assertExists(jobRow, 'payroll job');

    await db.insert(jobAssignments).values({
      tenantId: testTenantId,
      jobId: job.id,
      employeeId: testEmployeeId,
      commissionAmountCents: 10000,
      commissionCalculatedAt: new Date(2024, 2, 16),
    });
  });

  afterAll(async () => {
    await cleanup(testTenantId, 'test-payroll-p12');
  });

  it('1. Should create a payroll period', async () => {
    const periodRow = await payrollService.createPeriod(testTenantId, 2024, 3);
    const period = assertExists(periodRow, 'created payroll period');
    expect(period.id).toBeDefined();
    expect(period.month).toBe(3);
    createdPeriodId = period.id;
  });

  it('2. Should reject duplicate period', async () => {
    await expect(payrollService.createPeriod(testTenantId, 2024, 3)).rejects.toThrow();
  });

  it('3. Should generate entries using UPSERT', async () => {
    const result = await payrollService.generateEntries(testTenantId, createdPeriodId, testUserId);
    expect(result.generated).toBe(1);

    const result2 = await payrollService.generateEntries(testTenantId, createdPeriodId, testUserId);
    expect(result2.generated).toBe(1);

    const entries = await db.select().from(payrollEntries).where(eq(payrollEntries.periodId, createdPeriodId));
    expect(entries.length).toBe(1);
  });

  it('4. Should consolidate commissions in generateEntries (11.03)', async () => {
    const [entryRow] = await db
      .select()
      .from(payrollEntries)
      .where(and(eq(payrollEntries.periodId, createdPeriodId), eq(payrollEntries.employeeId, testEmployeeId)));
    const entry = assertExists(entryRow, 'payroll entry');
    expect(entry.commissionsCents).toBe(10000);
  });

  it('5. Should calculate gross = salary + commissions + bonus', async () => {
    const [entryRow] = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, testEmployeeId));
    const entry = assertExists(entryRow, 'payroll entry');
    expect(entry.grossCents).toBe(310000);
  });

  it('6. Should calculate net = gross - discounts', async () => {
    const [entryRow] = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, testEmployeeId));
    const entry = assertExists(entryRow, 'payroll entry');
    expect(entry.netCents).toBe(310000);
  });

  it('7. Should update entry and recalcule totals (11.02)', async () => {
    const [entryRow] = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, testEmployeeId));
    const entry = assertExists(entryRow, 'payroll entry');

    const updatedRow = await payrollService.updateEntry(
      testTenantId,
      {
        entryId: entry.id,
        bonusCents: 5000,
        discountsCents: 2000,
      },
      testUserId,
    );
    const updated = assertExists(updatedRow, 'updated payroll entry');

    expect(updated.grossCents).toBe(315000);
    expect(updated.netCents).toBe(313000);
  });

  it('8. Should generate payslip placeholder (11.06)', async () => {
    const pdf = await payrollService.generatePayslipPdf(testTenantId, createdPeriodId, testEmployeeId);
    expect(pdf).toBeDefined();
  });

  it('9. Should close period and block edits (11.04)', async () => {
    await payrollService.closePeriod(testTenantId, createdPeriodId, testUserId);
    const [entryRow] = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, testEmployeeId));
    const entry = assertExists(entryRow, 'payroll entry');

    await expect(
      payrollService.updateEntry(testTenantId, { entryId: entry.id, bonusCents: 1 }, testUserId),
    ).rejects.toThrow();
  });

  it('10. Should verify period totalizers (11.05)', async () => {
    const [periodRow] = await db.select().from(payrollPeriods).where(eq(payrollPeriods.id, createdPeriodId));
    const period = assertExists(periodRow, 'payroll period');
    expect(period.totalGrossCents).toBe(315000);
    expect(period.totalNetCents).toBe(313000);
  });
});
