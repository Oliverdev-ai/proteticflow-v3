import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../db/index.js';
import { employees, employeeSkills, jobAssignments, commissionPayments } from '../../db/schema/employees.js';
import { users } from '../../db/schema/users.js';
import { tenants } from '../../db/schema/tenants.js';
import { clients } from '../../db/schema/clients.js';
import { jobs } from '../../db/schema/jobs.js';
import * as employeeService from './service.js';
import { eq, and, isNull, sql } from 'drizzle-orm';

describe('Employees Module - Phase 11 (CRUD & Skills)', () => {
  let testTenantId: number;
  let testUserId: number;
  let createdEmployeeId: number;
  let testClientId: number;
  let testJobId: number;

  async function cleanup(tenantId: number | undefined, slug: string) {
    if (tenantId) {
      // Order matters due to FKs. Catching errors because some tables might not exist in early phases.
      const run = (q: string) => db.execute(sql.raw(q)).catch(() => {});
      
      await run(`DELETE FROM chat_messages WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM notifications WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM employee_skills WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM job_assignments WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM employees WHERE tenant_id = ${tenantId}`);
      await run(`DELETE FROM users WHERE active_tenant_id = ${tenantId} OR email = 'admin@testsession.com'`);
      await run(`DELETE FROM tenants WHERE id = ${tenantId}`);
    } else {
      // If we don't have ID, search by slug
      const [t] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug));
      if (t) await cleanup(t.id, slug);
    }
  }

  beforeAll(async () => {
    // 0. Cleanup previous failed runs
    await cleanup(undefined, 'test-lab-sessions');

    // 1. Setup Tenant
    const [tenant] = await db.insert(tenants).values({
      name: 'Test Lab Sessions',
      slug: 'test-lab-sessions',
    }).returning();
    testTenantId = tenant.id;

    // 2. Setup User
    const testEmail = `admin-${Date.now()}@testsession.com`;
    try {
      const [user] = await db.insert(users).values({
        activeTenantId: testTenantId,
        name: 'Admin User',
        email: testEmail,
        passwordHash: 'hashed',
        role: 'admin' as any,
      }).returning();
      testUserId = user.id;
    } catch (e: any) {
      console.error('FAILED TO CREATE USER:', testEmail, e?.message || e);
      throw e;
    }

    // 3. Setup Client
    const [client] = await db.insert(clients).values({
      tenantId: testTenantId,
      name: 'Test Clinic',
    }).returning();
    testClientId = client.id;

    // 4. Setup Job
    const [job] = await db.insert(jobs).values({
      tenantId: testTenantId,
      clientId: testClientId,
      code: 'JOB-001',
      deadline: new Date(),
    }).returning();
    testJobId = job.id;
  });

  afterAll(async () => {
    // Cleanup - Drizzle handles cascade if configured or we do it manually
    await cleanup(testTenantId, 'test-lab-sessions');
  });

  it('1. Should create employee with all 36 fields (as possible)', async () => {
    const employeeData = {
      name: 'Marcelo Oliveira',
      cpf: '123.456.789-00',
      rg: '12.345.678-9',
      birthDate: new Date('1990-01-01').toISOString(),
      email: 'marcelo@example.com',
      phone: '(11) 98888-8888',
      phone2: '(11) 97777-7777',
      street: 'Rua das Flores',
      addressNumber: '123',
      complement: 'Apto 45',
      neighborhood: 'Jardins',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01234-567',
      admissionDate: new Date().toISOString(),
      position: 'Protesista Sênior',
      department: 'Laboratório Principal',
      type: 'protesista' as const,
      contractType: 'pj_mei' as const,
      baseSalaryCents: 500000, // R$ 5.000,00
      transportAllowanceCents: 20000,
      mealAllowanceCents: 30000,
      healthInsuranceCents: 15000,
      bankName: 'Banco do Brasil',
      bankAgency: '1234-5',
      bankAccount: '123456-7',
      defaultCommissionPercent: 10.50,
      notes: 'Funcionário excelente',
      isActive: true,
    };

    const employee = await employeeService.createEmployee(testTenantId, employeeData, testUserId);
    expect(employee.id).toBeDefined();
    expect(employee.name).toBe(employeeData.name);
    expect(employee.type).toBe('protesista');
    expect(employee.baseSalaryCents).toBe(500000);
    createdEmployeeId = employee.id!;
    console.log('TEST 1 DONE, ID:', createdEmployeeId);
  });

  it('2. Should list employees - search by name', async () => {
    const res = await employeeService.listEmployees(testTenantId, { 
      search: 'Marcelo', 
      page: 1, 
      limit: 10 
    });
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0].name).toContain('Marcelo');
  });

  it('3. Should list employees - filter by type (protesista)', async () => {
    const res = await employeeService.listEmployees(testTenantId, { 
      type: 'protesista',
      page: 1, 
      limit: 10 
    });
    expect(res.data.every(e => e.type === 'protesista')).toBe(true);
  });

  it('4. Should list employees - filter by contractType (pj_mei)', async () => {
    const res = await employeeService.listEmployees(testTenantId, { 
      contractType: 'pj_mei',
      page: 1, 
      limit: 10 
    });
    expect(res.data.every(e => e.contractType === 'pj_mei')).toBe(true);
  });

  it('5. Should update employee fields', async () => {
    const updateData = { name: 'Marcelo O. Silva', baseSalaryCents: 600000 };
    console.log('TEST 5 STARTING, ID:', createdEmployeeId);
    const updated = await employeeService.updateEmployee(testTenantId, createdEmployeeId, updateData, testUserId);
    expect(updated.name).toBe('Marcelo O. Silva');
    expect(updated.baseSalaryCents).toBe(600000);
  });

  it('6. Should dismiss employee (soft delete / inactive)', async () => {
    const dismissalDate = new Date().toISOString();
    const updated = await employeeService.dismissEmployee(testTenantId, createdEmployeeId, dismissalDate, testUserId);
    expect(updated.isActive).toBe(false);
    expect(updated.dismissalDate).not.toBeNull();
  });

  it('7. Should not return dismissed employees by default in list', async () => {
    const res = await employeeService.listEmployees(testTenantId, { 
      page: 1, 
      limit: 10 
    });
    // Should be zero because we only created one and it is now inactive
    expect(res.data.filter(e => e.id === createdEmployeeId).length).toBe(0);
  });

  it('8. Should add skill to employee', async () => {
    // Re-enable for skill test or use another one
    await db.update(employees).set({ isActive: true }).where(eq(employees.id, createdEmployeeId));
    
    const skillData = {
      employeeId: createdEmployeeId,
      name: 'Cerâmica Feldspática',
      level: 4,
      description: 'Nível mestre'
    };
    const skill = await employeeService.addSkill(testTenantId, skillData);
    expect(skill.id).toBeDefined();
    expect(skill.name).toBe('Cerâmica Feldspática');
  });

  it('9. Should list skills of employee', async () => {
    const skills = await employeeService.listSkills(testTenantId, createdEmployeeId);
    expect(skills.length).toBeGreaterThan(0);
    expect(skills[0].name).toBe('Cerâmica Feldspática');
  });

  it('10. Should assign job to employee', async () => {
    const assignment = await employeeService.assignJob(testTenantId, {
      employeeId: createdEmployeeId,
      jobId: testJobId,
      task: 'Modelagem inicial',
    });
    expect(assignment.id).toBeDefined();
    expect(assignment.task).toBe('Modelagem inicial');
  });

  it('11. Should list assignments of employee', async () => {
    const assignments = await employeeService.listAssignments(testTenantId, createdEmployeeId);
    expect(assignments.length).toBeGreaterThan(0);
    expect(assignments[0].jobId).toBe(testJobId);
  });

  it('12. Should record a commission payment', async () => {
    const payment = await employeeService.payCommissions(testTenantId, {
      employeeId: createdEmployeeId,
      periodStart: new Date('2024-03-01').toISOString(),
      periodEnd: new Date('2024-03-31').toISOString(),
      paymentMethod: 'pix',
      notes: 'Bonus de performance',
    }, testUserId);
    expect(payment.id).toBeDefined();
    expect(payment.status).toBe('paid');
  });

  it('13. Should calculate/list commission payments', async () => {
    const results = await employeeService.calculateCommissions(testTenantId, {
      employeeId: createdEmployeeId,
      dateFrom: '2024-03-01',
      dateTo: '2024-03-31',
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].employeeId).toBe(createdEmployeeId);
  });
});
