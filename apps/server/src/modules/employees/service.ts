import { db } from '../../db/index.js';
import { employees, employeeSkills, jobAssignments, commissionPayments } from '../../db/schema/employees.js';
import { jobs } from '../../db/schema/jobs.js';
import { cashbookEntries } from '../../db/schema/financials.js';
import { eq, and, isNull, isNotNull, sql, desc, inArray, sum, count, ilike, or } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createEmployeeSchema, updateEmployeeSchema, createSkillSchema, createAssignmentSchema, createCommissionPaymentSchema, productionReportSchema, listEmployeesSchema } from '@proteticflow/shared';
import { logger } from '../../logger.js';

type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
type ListEmployeesInput = z.infer<typeof listEmployeesSchema>;

// ─── CRUD (10.01–10.08) ──────────────────────────────────────────────────────

export async function createEmployee(tenantId: number, input: CreateEmployeeInput, userId: number) {
  const data: typeof employees.$inferInsert = {
    tenantId,
    name: input.name,
    cpf: input.cpf ?? null,
    rg: input.rg ?? null,
    birthDate: input.birthDate ? new Date(input.birthDate) : null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    phone2: input.phone2 ?? null,
    street: input.street ?? null,
    addressNumber: input.addressNumber ?? null,
    complement: input.complement ?? null,
    neighborhood: input.neighborhood ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    zipCode: input.zipCode ?? null,
    admissionDate: input.admissionDate ? new Date(input.admissionDate) : null,
    position: input.position ?? null,
    department: input.department ?? null,
    type: input.type,
    contractType: input.contractType,
    baseSalaryCents: input.baseSalaryCents,
    transportAllowanceCents: input.transportAllowanceCents,
    mealAllowanceCents: input.mealAllowanceCents,
    healthInsuranceCents: input.healthInsuranceCents,
    bankName: input.bankName ?? null,
    bankAgency: input.bankAgency ?? null,
    bankAccount: input.bankAccount ?? null,
    defaultCommissionPercent: String(input.defaultCommissionPercent),
    userId: input.userId ?? null,
    notes: input.notes ?? null,
    createdBy: userId,
  };

  const [employee] = await db.insert(employees).values(data as typeof employees.$inferInsert).returning();
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

  const skills = await db
    .select()
    .from(employeeSkills)
    .where(and(eq(employeeSkills.employeeId, id), eq(employeeSkills.tenantId, tenantId)));
  
  return { ...employee, skills };
}

export async function updateEmployee(tenantId: number, id: number, input: UpdateEmployeeInput, _userId: number) {
  const data: Partial<typeof employees.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.name !== undefined) data.name = input.name;
  if (input.cpf !== undefined) data.cpf = input.cpf;
  if (input.rg !== undefined) data.rg = input.rg;
  if (input.birthDate !== undefined) data.birthDate = input.birthDate ? new Date(input.birthDate) : null;
  if (input.email !== undefined) data.email = input.email;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.phone2 !== undefined) data.phone2 = input.phone2;
  if (input.street !== undefined) data.street = input.street;
  if (input.addressNumber !== undefined) data.addressNumber = input.addressNumber;
  if (input.complement !== undefined) data.complement = input.complement;
  if (input.neighborhood !== undefined) data.neighborhood = input.neighborhood;
  if (input.city !== undefined) data.city = input.city;
  if (input.state !== undefined) data.state = input.state;
  if (input.zipCode !== undefined) data.zipCode = input.zipCode;
  if (input.admissionDate !== undefined) data.admissionDate = input.admissionDate ? new Date(input.admissionDate) : null;
  if (input.position !== undefined) data.position = input.position;
  if (input.department !== undefined) data.department = input.department;
  if (input.type !== undefined) data.type = input.type;
  if (input.contractType !== undefined) data.contractType = input.contractType;
  if (input.baseSalaryCents !== undefined) data.baseSalaryCents = input.baseSalaryCents;
  if (input.transportAllowanceCents !== undefined) data.transportAllowanceCents = input.transportAllowanceCents;
  if (input.mealAllowanceCents !== undefined) data.mealAllowanceCents = input.mealAllowanceCents;
  if (input.healthInsuranceCents !== undefined) data.healthInsuranceCents = input.healthInsuranceCents;
  if (input.bankName !== undefined) data.bankName = input.bankName;
  if (input.bankAgency !== undefined) data.bankAgency = input.bankAgency;
  if (input.bankAccount !== undefined) data.bankAccount = input.bankAccount;
  if (input.defaultCommissionPercent !== undefined) data.defaultCommissionPercent = String(input.defaultCommissionPercent);
  if (input.userId !== undefined) data.userId = input.userId;
  if (input.notes !== undefined) data.notes = input.notes;

  const [updated] = await db.update(employees)
    .set(data as Partial<typeof employees.$inferInsert>)
    .where(and(eq(employees.id, id), eq(employees.tenantId, tenantId), isNull(employees.deletedAt)))
    .returning();

  if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Funcionário não encontrado' });

  logger.info({ action: 'employee.update', tenantId, employeeId: id }, 'Employee updated');
  return updated;
}

export async function dismissEmployee(tenantId: number, id: number, dismissalDate: string, _userId: number) {
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

  const assignmentData: typeof jobAssignments.$inferInsert = {
    tenantId,
    jobId: input.jobId,
    employeeId: input.employeeId,
    task: input.task ?? null,
    commissionOverridePercent: input.commissionOverridePercent ? String(input.commissionOverridePercent) : null,
  };
  const [assignment] = await db
    .insert(jobAssignments)
    .values(assignmentData as typeof jobAssignments.$inferInsert)
    .returning();

  return assignment;
}

export async function listAssignments(tenantId: number, employeeId?: number) {
  return db.select().from(jobAssignments)
    .where(and(
      eq(jobAssignments.tenantId, tenantId),
      employeeId ? eq(jobAssignments.employeeId, employeeId) : undefined
    ))
    .orderBy(desc(jobAssignments.createdAt));
}

// ─── COMISSÕES (10.11–10.12) ───────────────────────────────────────────────

export async function calculateCommissions(tenantId: number, dateFrom: string, dateTo: string) {
  return db.transaction(async (tx) => {
    // 1. Buscar todos os assignments cujos jobs estão ready/delivered no período e sem comissão calculada
    const assignmentsToCalculate = await tx
      .select({
        assignmentId: jobAssignments.id,
        jobTotalCents: jobs.totalCents,
        overridePercent: jobAssignments.commissionOverridePercent,
        defaultPercent: employees.defaultCommissionPercent,
      })
      .from(jobAssignments)
      .innerJoin(jobs, eq(jobs.id, jobAssignments.jobId))
      .innerJoin(employees, eq(employees.id, jobAssignments.employeeId))
      .where(and(
        eq(jobAssignments.tenantId, tenantId),
        inArray(jobs.status, ['ready', 'delivered']),
        sql`${jobs.completedAt} >= ${new Date(dateFrom)}`,
        sql`${jobs.completedAt} <= ${new Date(dateTo)}`,
        isNull(jobAssignments.commissionCalculatedAt)
      ));

    let totalCalculated = 0;
    let totalCentsCalculated = 0;

    for (const row of assignmentsToCalculate) {
      const percent = parseFloat(row.overridePercent || row.defaultPercent || '0');
      const amountCents = Math.round((row.jobTotalCents * percent) / 100);

      await tx.update(jobAssignments)
        .set({
          commissionAmountCents: amountCents,
          commissionCalculatedAt: new Date(),
        })
        .where(eq(jobAssignments.id, row.assignmentId));
      
      totalCalculated++;
      totalCentsCalculated += amountCents;
    }

    logger.info({ action: 'employee.commission.calculate', tenantId, totalCalculated, totalCentsCalculated }, 'Commissions calculated');
    return { calculated: totalCalculated, totalCents: totalCentsCalculated };
  });
}

export async function createCommissionPayment(tenantId: number, input: z.infer<typeof createCommissionPaymentSchema>, userId: number) {
  return db.transaction(async (tx) => {
    // 1. Somar comissões calculadas no período
    const [row] = await tx.select({
      total: sum(jobAssignments.commissionAmountCents)
    })
    .from(jobAssignments)
    .where(and(
      eq(jobAssignments.tenantId, tenantId),
      eq(jobAssignments.employeeId, input.employeeId),
      sql`${jobAssignments.commissionCalculatedAt} >= ${new Date(input.periodStart)}`,
      sql`${jobAssignments.commissionCalculatedAt} <= ${new Date(input.periodEnd)}`
    ));

    const totalCents = parseInt((row?.total as string) || '0');
    if (totalCents <= 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nenhuma comissão pendente no período' });

    // 2. Criar pagamento
    const [payment] = await tx.insert(commissionPayments).values({
      tenantId,
      employeeId: input.employeeId,
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd),
      totalCents,
      paymentMethod: input.paymentMethod || null,
      reference: input.reference || null,
      status: 'paid', // PRD pede 'pending' -> 'paid', mas plano diz "insere cashbook entry" (pago)
      paidAt: new Date(),
      createdBy: userId,
      notes: input.notes || null,
    }).returning();

    // 3. Inserir no financeiro (PAD-02 / AP-14)
    const [emp] = await tx.select({ name: employees.name }).from(employees).where(eq(employees.id, input.employeeId));
    await tx.insert(cashbookEntries).values({
      tenantId,
      type: 'debit',
      amountCents: totalCents,
      description: `Comissão de ${emp?.name || 'Funcionário'}`,
      category: 'comissao',
      referenceDate: new Date(),
      createdBy: userId,
    });

    logger.info({ action: 'employee.commission.paid', tenantId, employeeId: input.employeeId, totalCents }, 'Commission payment recorded');
    return payment;
  });
}

export async function getProductionReport(tenantId: number, input: z.infer<typeof productionReportSchema>) {
  const { employeeId, dateFrom, dateTo } = input;

  const query = db
    .select({
      employeeId: employees.id,
      employeeName: employees.name,
      jobsCompleted: count(jobs.id),
      totalValueCents: sum(jobs.totalCents),
      commissionsCents: sum(jobAssignments.commissionAmountCents),
    })
    .from(employees)
    .innerJoin(jobAssignments, eq(jobAssignments.employeeId, employees.id))
    .innerJoin(jobs, eq(jobs.id, jobAssignments.jobId))
    .where(and(
      eq(employees.tenantId, tenantId),
      employeeId ? eq(employees.id, employeeId) : undefined,
      inArray(jobs.status, ['ready', 'delivered']),
      sql`${jobs.completedAt} >= ${new Date(dateFrom)}`,
      sql`${jobs.completedAt} <= ${new Date(dateTo)}`
    ))
    .groupBy(employees.id, employees.name)
    .orderBy(desc(sql`sum(${jobs.totalCents})`));

  return query;
}

export async function getCommissionDetails(tenantId: number, input: z.infer<typeof productionReportSchema>) {
  const { employeeId, dateFrom, dateTo } = input;

  const conditions = [
    eq(jobAssignments.tenantId, tenantId),
    isNotNull(jobAssignments.commissionAmountCents),
    sql`${jobs.completedAt} >= ${new Date(dateFrom)}`,
    sql`${jobs.completedAt} <= ${new Date(dateTo)}`,
  ];
  if (employeeId) conditions.push(eq(jobAssignments.employeeId, employeeId));

  return db
    .select({
      employeeId: employees.id,
      employeeName: employees.name,
      jobId: jobs.id,
      jobCode: jobs.code,
      task: jobAssignments.task,
      jobTotalCents: jobs.totalCents,
      commissionPercent: sql<string>`COALESCE(${jobAssignments.commissionOverridePercent}, ${employees.defaultCommissionPercent})`,
      commissionAmountCents: jobAssignments.commissionAmountCents,
    })
    .from(jobAssignments)
    .innerJoin(employees, eq(employees.id, jobAssignments.employeeId))
    .innerJoin(jobs, eq(jobs.id, jobAssignments.jobId))
    .where(and(...conditions))
    .orderBy(desc(jobs.completedAt));
}
