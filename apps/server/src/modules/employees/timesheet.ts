import { TRPCError } from '@trpc/server';
import { and, eq, gte, lte, sql, desc, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { employees, timesheets } from '../../db/schema/index.js';

function toMonthRange(month: number, year: number): { startDate: string; endDate: string } {
  const safeMonth = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    startDate: `${year}-${safeMonth}-01`,
    endDate: `${year}-${safeMonth}-${String(lastDay).padStart(2, '0')}`,
  };
}

function parseTimeToMinutes(timeValue: string): number {
  const parts = timeValue.split(':');
  if (parts.length !== 2) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Hora invalida' });
  }

  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Hora invalida' });
  }

  return hour * 60 + minute;
}

function parseNumeric(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }
  return (error as { code?: string }).code === '23505';
}

async function ensureEmployeeOwnedByTenant(tenantId: number, employeeId: number) {
  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(
      eq(employees.id, employeeId),
      eq(employees.tenantId, tenantId),
      isNull(employees.deletedAt),
    ));

  if (!employee) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Funcionario nao encontrado' });
  }
}

export async function clockIn(
  tenantId: number,
  employeeId: number,
  date: string,
  time: string,
  notes?: string,
) {
  await ensureEmployeeOwnedByTenant(tenantId, employeeId);

  const [existing] = await db
    .select()
    .from(timesheets)
    .where(and(
      eq(timesheets.tenantId, tenantId),
      eq(timesheets.employeeId, employeeId),
      eq(timesheets.date, date),
    ));

  if (existing?.clockIn) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Entrada ja registrada para este dia' });
  }

  if (existing) {
    const [updated] = await db
      .update(timesheets)
      .set({
        clockIn: time,
        notes: notes ?? existing.notes,
      })
      .where(eq(timesheets.id, existing.id))
      .returning();

    if (!updated) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao registrar entrada' });
    }
    return updated;
  }

  let created: typeof timesheets.$inferSelect | undefined;
  try {
    [created] = await db
      .insert(timesheets)
      .values({
        tenantId,
        employeeId,
        date,
        clockIn: time,
        notes: notes ?? null,
      })
      .returning();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Entrada ja registrada para este dia' });
    }
    throw error;
  }

  if (!created) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao registrar entrada' });
  }

  return created;
}

export async function clockOut(
  tenantId: number,
  employeeId: number,
  date: string,
  time: string,
  notes?: string,
) {
  await ensureEmployeeOwnedByTenant(tenantId, employeeId);

  const [existing] = await db
    .select()
    .from(timesheets)
    .where(and(
      eq(timesheets.tenantId, tenantId),
      eq(timesheets.employeeId, employeeId),
      eq(timesheets.date, date),
    ));

  if (!existing) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nao existe entrada registrada para este dia' });
  }
  if (!existing.clockIn) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nao e possivel registrar saida sem entrada' });
  }
  if (existing.clockOut) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Saida ja registrada para este dia' });
  }

  const clockInMinutes = parseTimeToMinutes(existing.clockIn);
  const clockOutMinutes = parseTimeToMinutes(time);
  if (clockOutMinutes < clockInMinutes) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Horario de saida nao pode ser menor que entrada' });
  }

  const hoursWorked = ((clockOutMinutes - clockInMinutes) / 60).toFixed(2);

  const [updated] = await db
    .update(timesheets)
    .set({
      clockOut: time,
      hoursWorked,
      notes: notes ?? existing.notes,
    })
    .where(eq(timesheets.id, existing.id))
    .returning();

  if (!updated) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao registrar saida' });
  }

  return updated;
}

export async function listTimesheets(
  tenantId: number,
  employeeId: number,
  month: number,
  year: number,
) {
  await ensureEmployeeOwnedByTenant(tenantId, employeeId);
  const { startDate, endDate } = toMonthRange(month, year);

  return db
    .select()
    .from(timesheets)
    .where(and(
      eq(timesheets.tenantId, tenantId),
      eq(timesheets.employeeId, employeeId),
      gte(timesheets.date, startDate),
      lte(timesheets.date, endDate),
    ))
    .orderBy(desc(timesheets.date));
}

export async function getMonthlyHoursSummary(
  tenantId: number,
  employeeId: number,
  month: number,
  year: number,
) {
  await ensureEmployeeOwnedByTenant(tenantId, employeeId);
  const { startDate, endDate } = toMonthRange(month, year);

  const [summary] = await db
    .select({
      totalHours: sql<number>`coalesce(sum(${timesheets.hoursWorked}), 0)`,
      totalDays: sql<number>`count(*)`,
      workedDays: sql<number>`sum(case when ${timesheets.hoursWorked} is not null then 1 else 0 end)`,
      openDays: sql<number>`sum(case when ${timesheets.clockIn} is not null and ${timesheets.clockOut} is null then 1 else 0 end)`,
    })
    .from(timesheets)
    .where(and(
      eq(timesheets.tenantId, tenantId),
      eq(timesheets.employeeId, employeeId),
      gte(timesheets.date, startDate),
      lte(timesheets.date, endDate),
    ));

  return {
    totalHours: Number(parseNumeric(summary?.totalHours).toFixed(2)),
    totalDays: Number(summary?.totalDays ?? 0),
    workedDays: Number(summary?.workedDays ?? 0),
    openDays: Number(summary?.openDays ?? 0),
  };
}
