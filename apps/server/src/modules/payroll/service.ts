import { db } from '../../db/index.js';
import { payrollPeriods, payrollEntries, employees, jobAssignments } from '../../db/schema/index.js';
import { eq, and, isNull, sql, desc, sum } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { logger } from '../../logger.js';
import { updatePayrollEntrySchema } from '@proteticflow/shared';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

type PayrollEntry = typeof payrollEntries.$inferSelect;
type UpdatePayrollEntryInput = z.infer<typeof updatePayrollEntrySchema>;

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

export async function updateEntry(tenantId: number, input: UpdatePayrollEntryInput, userId: number) {
  return db.transaction(async (tx) => {
    const [entry] = await tx.select().from(payrollEntries).where(and(eq(payrollEntries.id, input.entryId), eq(payrollEntries.tenantId, tenantId)));
    if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lançamento não encontrado' });

    const [period] = await tx.select().from(payrollPeriods).where(eq(payrollPeriods.id, entry.periodId));
    if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Período não encontrado' });
    if (period.status !== 'open') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Período fechado para edição' });

    const grossCents = entry.baseSalaryCents + entry.commissionsCents + (input.overtimeValueCents ?? entry.overtimeValueCents) + (input.bonusCents ?? entry.bonusCents);
    const netCents = grossCents - (input.discountsCents ?? entry.discountsCents);

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

async function calculatePeriodTotals(tx: PgTransaction<PostgresJsQueryResultHKT, any, any>, tenantId: number, periodId: number) {
  const entries = await tx.select().from(payrollEntries).where(eq(payrollEntries.periodId, periodId));
  const totalGrossCents = entries.reduce((acc: number, curr: PayrollEntry) => acc + curr.grossCents, 0);
  const totalDiscountsCents = entries.reduce((acc: number, curr: PayrollEntry) => acc + curr.discountsCents, 0);
  const totalNetCents = entries.reduce((acc: number, curr: PayrollEntry) => acc + curr.netCents, 0);

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

import jsPDF from 'jspdf';
import 'jspdf-autotable';

export async function generatePayslipPdf(tenantId: number, periodId: number, employeeId: number) {
  const [period] = await db.select().from(payrollPeriods).where(and(eq(payrollPeriods.id, periodId), eq(payrollPeriods.tenantId, tenantId)));
  if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Período não encontrado' });

  const [entry] = await db.select({
    baseSalaryCents: payrollEntries.baseSalaryCents,
    commissionsCents: payrollEntries.commissionsCents,
    overtimeValueCents: payrollEntries.overtimeValueCents,
    bonusCents: payrollEntries.bonusCents,
    discountsCents: payrollEntries.discountsCents,
    grossCents: payrollEntries.grossCents,
    netCents: payrollEntries.netCents,
    employeeName: employees.name,
    employeeCpf: employees.cpf,
  })
  .from(payrollEntries)
  .innerJoin(employees, eq(employees.id, payrollEntries.employeeId))
  .where(and(eq(payrollEntries.periodId, periodId), eq(payrollEntries.employeeId, employeeId)));

  if (!entry) throw new TRPCError({ code: 'NOT_FOUND', message: 'Lançamento não encontrado para este funcionário' });

  type JsPdfWithAutoTable = jsPDF & {
    autoTable: (options: unknown) => void;
    lastAutoTable?: { finalY: number };
  };
  const doc = new jsPDF() as JsPdfWithAutoTable;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ProteticFlow — Holerite de Pagamento', 14, 20);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Funcionário: ${entry.employeeName}`, 14, 30);
  doc.text(`CPF: ${entry.employeeCpf || '—'}`, 14, 37);
  doc.text(`Período: ${period.month}/${period.year}`, 14, 44);

  const tableRows = [
    ['Salário Base', `R$ ${(entry.baseSalaryCents / 100).toFixed(2)}`, ''],
    ['Comissões', `R$ ${(entry.commissionsCents / 100).toFixed(2)}`, ''],
    ['Horas Extras', `R$ ${(entry.overtimeValueCents / 100).toFixed(2)}`, ''],
    ['Bônus/Premiações', `R$ ${(entry.bonusCents / 100).toFixed(2)}`, ''],
    ['Descontos', '', `R$ ${(entry.discountsCents / 100).toFixed(2)}`],
  ];

  doc.autoTable({
    startY: 55,
    head: [['Descrição', 'Proventos', 'Descontos']],
    body: tableRows,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [31, 41, 55] },
  });

  const finalY = doc.lastAutoTable?.finalY ?? 100;

  doc.setFont('helvetica', 'bold');
  doc.text(`Total Bruto: R$ ${(entry.grossCents / 100).toFixed(2)}`, 140, finalY + 10);
  doc.text(`Total Líquido: R$ ${(entry.netCents / 100).toFixed(2)}`, 140, finalY + 17);

  doc.setFontSize(8);
  doc.text('Documento gerado eletronicamente via ProteticFlow.', 14, finalY + 30);

  return Buffer.from(doc.output('arraybuffer') as ArrayBuffer);
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
