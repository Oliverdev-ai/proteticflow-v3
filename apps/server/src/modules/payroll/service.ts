import { db } from '../../db/index.js';
import { payrollPeriods, payrollEntries, employees, jobAssignments } from '../../db/schema/index.js';
import { eq, and, isNull, sql, desc, sum } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { logger } from '../../logger.js';

// ─── PERÍODOS (11.01) ────────────────────────────────────────────────────────

export async function createPeriod(tenantId: number, year: number, month: number) {
  // Verificar se o período já existe para este tenant
  const [existing] = await db.select().from(payrollPeriods)
    .where(and(
      eq(payrollPeriods.tenantId, tenantId),
      eq(payrollPeriods.year, year),
      eq(payrollPeriods.month, month)
    ));
  
  if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Período já existe' });

  const [period] = await db.insert(payrollPeriods).values({
    tenantId,
    year,
    month,
    referenceDate: new Date(year, month - 1, 1),
    status: 'open',
  }).returning();

  return period;
}

export async function listPeriods(tenantId: number) {
  return db.select().from(payrollPeriods)
    .where(eq(payrollPeriods.tenantId, tenantId))
    .orderBy(desc(payrollPeriods.year), desc(payrollPeriods.month));
}

// ─── LANÇAMENTOS (11.02–11.03) ──────────────────────────────────────────────

export async function generateEntries(tenantId: number, periodId: number, userId: number) {
  return db.transaction(async (tx) => {
    const [period] = await tx.select().from(payrollPeriods)
      .where(and(eq(payrollPeriods.id, periodId), eq(payrollPeriods.tenantId, tenantId)));
    
    if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Período não encontrado' });
    if (period.status !== 'open') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Período já fechado' });

    // 1. Buscar funcionários ativos
    const activeEmployees = await tx.select().from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.isActive, true), isNull(employees.deletedAt)));

    let generatedCount = 0;

    for (const emp of activeEmployees) {
      // 2. Buscar comissões do mês (11.03)
      // Definir range do mês baseado no período
      const dateStart = new Date(period.year, period.month - 1, 1);
      const dateEnd = new Date(period.year, period.month, 0, 23, 59, 59);

      const [commRow] = await tx.select({
        total: sum(jobAssignments.commissionAmountCents)
      })
      .from(jobAssignments)
      .where(and(
        eq(jobAssignments.tenantId, tenantId),
        eq(jobAssignments.employeeId, emp.id),
        sql`${jobAssignments.commissionCalculatedAt} >= ${dateStart}`,
        sql`${jobAssignments.commissionCalculatedAt} <= ${dateEnd}`
      ));

      const commissionsCents = parseInt((commRow?.total as string) || '0');
      const baseSalaryCents = emp.baseSalaryCents || 0;
      
      // 3. UPSERT payrollEntry (11.04)
      const grossCents = baseSalaryCents + commissionsCents;
      const netCents = grossCents; // Inicialmente sem descontos

      await tx.insert(payrollEntries).values({
        tenantId,
        periodId,
        employeeId: emp.id,
        baseSalaryCents,
        commissionsCents,
        grossCents,
        netCents,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [payrollEntries.periodId, payrollEntries.employeeId],
        set: {
          baseSalaryCents,
          commissionsCents,
          grossCents,
          netCents, // TODO: se existirem descontos manuais, preservar? O plano diz consolidate salary+commissions.
          updatedAt: new Date(),
        }
      });
      
      generatedCount++;
    }

    // 4. Calcular totalizadores do período (11.05)
    await calculatePeriodTotals(tx, tenantId, periodId);

    logger.info({ action: 'payroll.generate', tenantId, periodId, entriesGenerated: generatedCount }, 'Payroll entries generated');
    return { generated: generatedCount };
  });
}

export async function updateEntry(tenantId: number, input: any, userId: number) {
  return db.transaction(async (tx) => {
    const [entry] = await tx.select().from(payrollEntries).where(eq(payrollEntries.id, input.entryId));
    if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lançamento não encontrado' });

    const [period] = await tx.select().from(payrollPeriods).where(eq(payrollPeriods.id, entry.periodId));
    if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Período não encontrado' });
    if (period.status !== 'open') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Período fechado para edição' });

    const grossCents = entry.baseSalaryCents + entry.commissionsCents + (input.overtimeValueCents || entry.overtimeValueCents) + (input.bonusCents || entry.bonusCents);
    const netCents = grossCents - (input.discountsCents || entry.discountsCents);

    const [updated] = await tx.update(payrollEntries)
      .set({
        overtimeHours: input.overtimeHours !== undefined ? String(input.overtimeHours) : entry.overtimeHours,
        overtimeValueCents: input.overtimeValueCents ?? entry.overtimeValueCents,
        bonusCents: input.bonusCents ?? entry.bonusCents,
        discountsCents: input.discountsCents ?? entry.discountsCents,
        grossCents,
        netCents,
        notes: input.notes ?? entry.notes,
        updatedAt: new Date(),
      })
      .where(eq(payrollEntries.id, input.entryId))
      .returning();

    await calculatePeriodTotals(tx, tenantId, entry.periodId);
    return updated;
  });
}

async function calculatePeriodTotals(tx: any, tenantId: number, periodId: number) {
  const entries = await tx.select().from(payrollEntries).where(eq(payrollEntries.periodId, periodId));
  const totalGrossCents = entries.reduce((acc: number, curr: any) => acc + curr.grossCents, 0);
  const totalDiscountsCents = entries.reduce((acc: number, curr: any) => acc + curr.discountsCents, 0);
  const totalNetCents = entries.reduce((acc: number, curr: any) => acc + curr.netCents, 0);

  await tx.update(payrollPeriods)
    .set({
      totalGrossCents,
      totalDiscountsCents,
      totalNetCents,
      updatedAt: new Date(),
    })
    .where(eq(payrollPeriods.id, periodId));
}

export async function closePeriod(tenantId: number, periodId: number, userId: number) {
  const [period] = await db.select().from(payrollPeriods)
    .where(and(eq(payrollPeriods.id, periodId), eq(payrollPeriods.tenantId, tenantId)));
  
  if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Período não encontrado' });
  if (period.status !== 'open') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Período já fechado' });

  const [updated] = await db.update(payrollPeriods)
    .set({
      status: 'closed',
      closedAt: new Date(),
      closedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(payrollPeriods.id, periodId))
    .returning();

  logger.info({ action: 'payroll.close', tenantId, periodId }, 'Payroll period closed');
  return updated;
}

export async function generatePayslipPdf(tenantId: number, periodId: number, employeeId: number) {
  // Placeholder para 11.06
  return Buffer.from('PDF Placeholder');
}

// ─── RELATÓRIOS (11.04) ───────────────────────────────────────────────────

export async function getPeriodReport(tenantId: number, periodId: number) {
  const [period] = await db.select().from(payrollPeriods)
    .where(and(eq(payrollPeriods.id, periodId), eq(payrollPeriods.tenantId, tenantId)));
  
  if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Período não encontrado' });

  const entries = await db.select({
    id: payrollEntries.id,
    employeeId: payrollEntries.employeeId,
    employeeName: employees.name,
    baseSalaryCents: payrollEntries.baseSalaryCents,
    commissionsCents: payrollEntries.commissionsCents,
    grossCents: payrollEntries.grossCents,
    netCents: payrollEntries.netCents,
    notes: payrollEntries.notes,
  })
  .from(payrollEntries)
  .innerJoin(employees, eq(employees.id, payrollEntries.employeeId))
  .where(eq(payrollEntries.periodId, periodId));

  return {
    period,
    entries,
  };
}
