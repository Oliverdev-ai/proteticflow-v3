import { db } from '../../db/index.js';
import { employees, employeeSkills, jobAssignments, commissionPayments } from '../../db/schema/index.js';
import { eq, and, ilike, or, sql, desc, count, isNull } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { 
  createEmployeeSchema, updateEmployeeSchema, listEmployeesSchema,
  createSkillSchema, createAssignmentSchema, createCommissionPaymentSchema,
  productionReportSchema 
} from '@proteticflow/shared';
import { z } from 'zod';
import { logger } from '../../logger.js';
import { cashbookEntries } from '../../db/schema/financials.js';

type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
type ListEmployeesInput = z.infer<typeof listEmployeesSchema>;

// ─── CRUD (10.01–10.08) ──────────────────────────────────────────────────────

export async function createEmployee(tenantId: number, input: CreateEmployeeInput, userId: number) {
  const data = {
    ...input,
    birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
    admissionDate: input.admissionDate ? new Date(input.admissionDate) : undefined,
    tenantId,
    createdBy: userId,
  };

  const [employee] = await db.insert(employees).values(data as any).returning();
  if (!employee) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao criar funcionário' });

  logger.info({ action: 'employee.create', tenantId, employeeId: employee.id }, 'Employee created');
  return employee;
}

export async function listEmployees(tenantId: number, input: ListEmployeesInput) {
  const { search, type, contractType, isActive, page, limit } = input;
  const offset = (page - 1) * limit;

  const where = and(
    eq(employees.tenantId, tenantId),
    isNull(employees.deletedAt),
    search ? or(
      ilike(employees.name, `%${search}%`),
      ilike(employees.cpf, `%${search}%`),
      ilike(employees.email, `%${search}%`)
    ) : undefined,
    type ? eq(employees.type, type) : undefined,
    contractType ? eq(employees.contractType, contractType) : undefined,
    isActive !== undefined ? eq(employees.isActive, isActive) : eq(employees.isActive, true)
  );

  const [totalResult] = await db.select({ value: count() }).from(employees).where(where);
  const data = await db.select().from(employees)
    .where(where)
    .limit(limit)
    .offset(offset)
    .orderBy(employees.name);

  return { data, total: totalResult?.value ?? 0 };
}

export async function getEmployee(tenantId: number, id: number) {
  const [employee] = await db.select().from(employees)
    .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId), isNull(employees.deletedAt)));
  
  if (!employee) throw new TRPCError({ code: 'NOT_FOUND', message: 'Funcionário não encontrado' });

  const skills = await db.select().from(employeeSkills).where(eq(employeeSkills.employeeId, id));
  
  return { ...employee, skills };
}

export async function updateEmployee(tenantId: number, id: number, input: UpdateEmployeeInput, userId: number) {
  const data = {
    ...input,
    birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
    admissionDate: input.admissionDate ? new Date(input.admissionDate) : undefined,
    updatedAt: new Date(),
  };

  const [updated] = await db.update(employees)
    .set(data as any)
    .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId), isNull(employees.deletedAt)))
    .returning();

  if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Funcionário não encontrado' });

  logger.info({ action: 'employee.update', tenantId, employeeId: id }, 'Employee updated');
  return updated;
}

export async function dismissEmployee(tenantId: number, id: number, dismissalDate: string, userId: number) {
  const [updated] = await db.update(employees)
    .set({ 
      dismissalDate: new Date(dismissalDate), 
      isActive: false, 
      updatedAt: new Date() 
    })
    .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId), isNull(employees.deletedAt)))
    .returning();

  if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Funcionário não encontrado' });

  logger.info({ action: 'employee.dismiss', tenantId, employeeId: id }, 'Employee dismissed');
  return updated;
}

// ─── HABILIDADES (10.09) ────────────────────────────────────────────────────

export async function addSkill(tenantId: number, input: z.infer<typeof createSkillSchema>) {
  // Verificar se o funcionário pertence ao tenant
  const [emp] = await db.select({ id: employees.id }).from(employees)
    .where(and(eq(employees.id, input.employeeId), eq(employees.tenantId, tenantId)));
  if (!emp) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Funcionário inválido' });

  const [skill] = await db.insert(employeeSkills).values({
    employeeId: input.employeeId,
    name: input.name,
    level: input.level,
    description: input.description ?? null,
    tenantId,
  }).returning();

  if (!skill) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Erro ao adicionar habilidade' });
  return skill;
}

export async function removeSkill(tenantId: number, skillId: number) {
  const [deleted] = await db.delete(employeeSkills)
    .where(and(eq(employeeSkills.id, skillId), eq(employeeSkills.tenantId, tenantId)))
    .returning();
  
  if (!deleted) throw new TRPCError({ code: 'NOT_FOUND', message: 'Habilidade não encontrada' });
}

export async function listSkills(tenantId: number, employeeId: number) {
  return db.select().from(employeeSkills)
    .where(and(eq(employeeSkills.tenantId, tenantId), eq(employeeSkills.employeeId, employeeId)));
}

// ─── ATRIBUIÇÕES (10.10) ───────────────────────────────────────────────────

export async function assignJob(tenantId: number, input: z.infer<typeof createAssignmentSchema>) {
  // Verificar se o funcionário pertence ao tenant
  const [emp] = await db.select({ id: employees.id }).from(employees)
    .where(and(eq(employees.id, input.employeeId), eq(employees.tenantId, tenantId)));
  if (!emp) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Funcionário inválido' });

  const [assignment] = await db.insert(jobAssignments).values({
    tenantId,
    jobId: input.jobId,
    employeeId: input.employeeId,
    task: input.task ?? null,
    commissionOverridePercent: input.commissionOverridePercent ? String(input.commissionOverridePercent) : null,
  } as any).returning();

  return assignment;
}

export async function listAssignments(tenantId: number, employeeId: number) {
  return db.select().from(jobAssignments)
    .where(and(eq(jobAssignments.tenantId, tenantId), eq(jobAssignments.employeeId, employeeId)))
    .orderBy(desc(jobAssignments.createdAt));
}

// ─── COMISSÕES (10.11) ──────────────────────────────────────────────────────

export async function calculateCommissions(tenantId: number, input: z.infer<typeof productionReportSchema>) {
  const { employeeId, dateFrom, dateTo } = input;
  
  const payments = await db.select().from(commissionPayments)
    .where(and(
      eq(commissionPayments.tenantId, tenantId),
      employeeId ? eq(commissionPayments.employeeId, employeeId) : undefined,
      sql`${commissionPayments.periodStart} >= ${new Date(dateFrom)}`,
      sql`${commissionPayments.periodEnd} <= ${new Date(dateTo)}`
    ));
    
  return payments;
}

export async function payCommissions(tenantId: number, input: z.infer<typeof createCommissionPaymentSchema>, userId: number) {
  // Nota: totalCents deve vir do cálculo de produção (Fase 11.11)
  // Por ora, usamos um valor fixo ou vindo do input se o schema permitir (o schema atual não tem totalCents)
  // Vou assumir que o schema de validação deve ser atualizado ou passamos zero por ora.
  const [payment] = await db.insert(commissionPayments).values({
    tenantId,
    employeeId: input.employeeId,
    periodStart: new Date(input.periodStart),
    periodEnd: new Date(input.periodEnd),
    totalCents: 0, // TODO: Implementar cálculo real
    paymentMethod: input.paymentMethod || null,
    reference: input.reference || null,
    status: 'paid',
    paidAt: new Date(),
    createdBy: userId,
    notes: input.notes || null,
  }).returning();

  return payment;
}
