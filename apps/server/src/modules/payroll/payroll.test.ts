import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../db/index.js';
import { employees, payrollPeriods, payrollEntries, jobAssignments, jobs, clients } from '../../db/schema/index.js';
import { users } from '../../db/schema/users.js';
import { tenants } from '../../db/schema/tenants.js';
import * as payrollService from './service.js';
import * as employeeService from '../employees/service.js';
import { eq, and, sql } from 'drizzle-orm';

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

    const [tenant] = await db.insert(tenants).values({ name: 'Payroll Phase 12', slug: 'test-payroll-p12' }).returning();
    testTenantId = tenant.id;

    const [user] = await db.insert(users).values({
      activeTenantId: testTenantId,
      name: 'Admin Payroll',
      email: `admin-pay-${Date.now()}@test.com`,
      passwordHash: 'hashed',
      role: 'admin' as any,
    }).returning();
    testUserId = user.id;

    const [employee] = await db.insert(employees).values({
      tenantId: testTenantId,
      name: 'Salary Staff',
      type: 'protesista' as any,
      contractType: 'clt' as any,
      isActive: true,
      baseSalaryCents: 300000,
      createdBy: testUserId,
      defaultCommissionPercent: 10,
    }).returning();
    testEmployeeId = employee.id;

    // Create a job and commission for testing consolidation (11.03)
    const [client] = await db.insert(clients).values({ tenantId: testTenantId, name: 'Payroll Clinic' }).returning();
    const [job] = await db.insert(jobs).values({
      tenantId: testTenantId,
      clientId: client.id,
      code: 'PAY-JOB',
      status: 'delivered',
      completedAt: new Date(2024, 2, 15), // Month 3
      deadline: new Date(),
      totalCents: 100000,
    }).returning();
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
    const period = await payrollService.createPeriod(testTenantId, 2024, 3);
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
    
    // Call again to verify UPSERT
    const result2 = await payrollService.generateEntries(testTenantId, createdPeriodId, testUserId);
    expect(result2.generated).toBe(1);
    
    const entries = await db.select().from(payrollEntries).where(eq(payrollEntries.periodId, createdPeriodId));
    expect(entries.length).toBe(1);
  });

  it('4. Should consolidate commissions in generateEntries (11.03)', async () => {
    const [entry] = await db.select().from(payrollEntries).where(and(eq(payrollEntries.periodId, createdPeriodId), eq(payrollEntries.employeeId, testEmployeeId)));
    expect(entry.commissionsCents).toBe(10000);
  });

  it('5. Should calculate gross = salary + commissions + bonus', async () => {
    const [entry] = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, testEmployeeId));
    expect(entry.grossCents).toBe(310000); // 3000 + 100
  });

  it('6. Should calculate net = gross - discounts', async () => {
    const [entry] = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, testEmployeeId));
    expect(entry.netCents).toBe(310000); // initial net = gross
  });

  it('7. Should update entry and recalcule totals (11.02)', async () => {
    const [entry] = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, testEmployeeId));
    const updated = await payrollService.updateEntry(testTenantId, {
      entryId: entry.id,
      bonusCents: 5000, // 50.00
      discountsCents: 2000, // 20.00
    }, testUserId);
    
    expect(updated.grossCents).toBe(315000); // 3100 + 50
    expect(updated.netCents).toBe(313000); // 3150 - 20
  });

  it('9. Should close period and block edits (11.04)', async () => {
    await payrollService.closePeriod(testTenantId, createdPeriodId, testUserId);
    const [entry] = await db.select().from(payrollEntries).where(eq(payrollEntries.employeeId, testEmployeeId));
    
    await expect(payrollService.updateEntry(testTenantId, { entryId: entry.id, bonusCents: 1 }, testUserId)).rejects.toThrow();
  });

  it('10. Should verify period totalizers (11.05)', async () => {
    const [period] = await db.select().from(payrollPeriods).where(eq(payrollPeriods.id, createdPeriodId));
    expect(period.totalGrossCents).toBe(315000);
    expect(period.totalNetCents).toBe(313000);
  });
  
  it('8. Should generate payslip placeholder (11.06)', async () => {
    const pdf = await payrollService.generatePayslipPdf(testTenantId, createdPeriodId, testEmployeeId);
    expect(pdf).toBeDefined();
  });
});
