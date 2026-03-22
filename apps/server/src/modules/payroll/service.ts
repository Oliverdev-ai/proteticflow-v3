import { db } from '../../db/index.js';
import { payrollPeriods, payrollEntries, employees } from '../../db/schema/index.js';
import { eq, and, isNull, sql, desc } from 'drizzle-orm';
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

// ─── LANÇAMENTOS (11.02) ────────────────────────────────────────────────────

export async function generateEntries(tenantId: number, periodId: number) {
  const [period] = await db.select().from(payrollPeriods)
    .where(and(eq(payrollPeriods.id, periodId), eq(payrollPeriods.tenantId, tenantId)));
  
  if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Período não encontrado' });
  if (period.status !== 'open') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Período já fechado' });

  // Buscar funcionários ativos
  const activeEmployees = await db.select().from(employees)
    .where(and(eq(employees.tenantId, tenantId), eq(employees.isActive, true), isNull(employees.deletedAt)));

  const entries = [];
  for (const emp of activeEmployees) {
    // Verificar se já existe lançamento para este funcionário no período
    const [existing] = await db.select().from(payrollEntries)
      .where(and(eq(payrollEntries.periodId, periodId), eq(payrollEntries.employeeId, emp.id)));
    
    if (existing) continue;

    // TODO: Buscar comissões do período
    const commissionsCents = 0;

    const baseSalaryCents = emp.baseSalaryCents || 0;
    const grossCents = baseSalaryCents + commissionsCents;
    const netCents = grossCents; // Simplificado por ora

    const [entry] = await db.insert(payrollEntries).values({
      tenantId,
      periodId,
      employeeId: emp.id,
      baseSalaryCents,
      commissionsCents,
      grossCents,
      netCents,
    }).returning();
    
    entries.push(entry);
  }

  return entries;
}

// ─── FECHAMENTO (11.03) ────────────────────────────────────────────────────

export async function closePeriod(tenantId: number, periodId: number, userId: number) {
  const [period] = await db.select().from(payrollPeriods)
    .where(and(eq(payrollPeriods.id, periodId), eq(payrollPeriods.tenantId, tenantId)));
  
  if (!period) throw new TRPCError({ code: 'NOT_FOUND', message: 'Período não encontrado' });
  if (period.status !== 'open') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Período já fechado' });

  // Calcular totais
  const entries = await db.select().from(payrollEntries).where(eq(payrollEntries.periodId, periodId));
  const totalGrossCents = entries.reduce((acc, curr) => acc + curr.grossCents, 0);
  const totalNetCents = entries.reduce((acc, curr) => acc + curr.netCents, 0);

  const [updated] = await db.update(payrollPeriods)
    .set({
      status: 'closed',
      closedAt: new Date(),
      closedBy: userId,
      totalGrossCents,
      totalNetCents,
      updatedAt: new Date(),
    })
    .where(eq(payrollPeriods.id, periodId))
    .returning();

  logger.info({ action: 'payroll.close', tenantId, periodId }, 'Payroll period closed');
  return updated;
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
