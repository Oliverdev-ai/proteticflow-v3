import { eq, and, gt, lt, inArray, isNull, sql } from 'drizzle-orm';
import jsPDF from 'jspdf';
import { db } from '../../db/index.js';
import { 
  accountsReceivable, 
  accountsPayable, 
  cashbookEntries, 
  financialClosings,
} from '../../db/schema/financials.js';
import { clients } from '../../db/schema/clients.js';
import { TRPCError } from '@trpc/server';
import { logger } from '../../logger.js';
import type { z } from 'zod';
import type { 
  createArSchema,
  listArSchema,
  markArPaidSchema,
  cancelArSchema,
  createApSchema,
  listApSchema,
  markApPaidSchema,
  cancelApSchema,
  generateClosingSchema,
  listCashbookSchema,
  createCashbookEntrySchema,
  cashFlowSchema,
  annualBalanceSchema,
  payerRankingSchema
} from '@proteticflow/shared';

type CreateArInput = z.infer<typeof createArSchema>;
type ListArInput = z.infer<typeof listArSchema>;
type MarkArPaidInput = z.infer<typeof markArPaidSchema>;
type CancelArInput = z.infer<typeof cancelArSchema>;

type CreateApInput = z.infer<typeof createApSchema>;
type ListApInput = z.infer<typeof listApSchema>;
type MarkApPaidInput = z.infer<typeof markApPaidSchema>;
type CancelApInput = z.infer<typeof cancelApSchema>;

type GenerateClosingInput = z.infer<typeof generateClosingSchema>;
type ListCashbookInput = z.infer<typeof listCashbookSchema>;
type CreateCashbookEntryInput = z.infer<typeof createCashbookEntrySchema>;
type CashFlowInput = z.infer<typeof cashFlowSchema>;
type AnnualBalanceInput = z.infer<typeof annualBalanceSchema>;
type PayerRankingInput = z.infer<typeof payerRankingSchema>;

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ─── AR (ACCOUNTS RECEIVABLE) ────────────────────────────────────────────────

export async function createAr(tenantId: number, input: CreateArInput) {
  const arData: typeof accountsReceivable.$inferInsert = {
    tenantId,
    jobId: input.jobId,
    clientId: input.clientId,
    amountCents: input.amountCents,
    dueDate: new Date(input.dueDate),
    status: 'pending',
  };
  if (input.description !== undefined) arData.description = input.description;

  const [ar] = await db.insert(accountsReceivable).values(arData).returning();
  if (!ar) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar conta a receber' });

  logger.info({ action: 'financial.ar.create', tenantId, arId: ar.id, jobId: input.jobId, amountCents: input.amountCents }, 'Conta a receber criada');
  return ar;
}

export async function autoCreateArFromJob(tenantId: number, jobId: number, clientId: number, totalCents: number, dueDate: Date, tx: DbTransaction) {
  if (totalCents <= 0) return null;

  const [ar] = await tx.insert(accountsReceivable).values({
    tenantId,
    jobId,
    clientId,
    amountCents: totalCents,
    description: `Referente à OS #${jobId}`,
    dueDate,
    status: 'pending',
  }).returning();
  if (!ar) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar AR automatico' });

  logger.info({ action: 'financial.ar.auto_create', tenantId, arId: ar.id, jobId, amountCents: totalCents }, 'AR gerado automaticamente pela OS');
  return ar;
}

export async function listAr(tenantId: number, filters: ListArInput) {
  const conditions = [eq(accountsReceivable.tenantId, tenantId)];

  if (filters.status) conditions.push(eq(accountsReceivable.status, filters.status));
  if (filters.clientId) conditions.push(eq(accountsReceivable.clientId, filters.clientId));
  if (filters.cursor) conditions.push(gt(accountsReceivable.id, filters.cursor));
  
  if (filters.dateFrom) conditions.push(sql`${accountsReceivable.dueDate} >= ${new Date(filters.dateFrom)}`);
  if (filters.dateTo) conditions.push(sql`${accountsReceivable.dueDate} <= ${new Date(filters.dateTo)}`);

  const data = await db
    .select({
      ar: accountsReceivable,
      clientName: clients.name
    })
    .from(accountsReceivable)
    .leftJoin(clients, eq(accountsReceivable.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(sql`${accountsReceivable.id} DESC`)
    .limit(filters.limit + 1);

  const hasMore = data.length > filters.limit;
  const items = hasMore ? data.slice(0, filters.limit) : data;
  const nextCursor = hasMore ? items[items.length - 1]?.ar.id : undefined;

  return { data: items, nextCursor };
}

export async function getAr(tenantId: number, arId: number) {
  const [data] = await db
    .select({
      ar: accountsReceivable,
      clientName: clients.name
    })
    .from(accountsReceivable)
    .leftJoin(clients, eq(accountsReceivable.clientId, clients.id))
    .where(and(eq(accountsReceivable.tenantId, tenantId), eq(accountsReceivable.id, arId)));

  if (!data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conta a receber não encontrada' });
  return data;
}

export async function markArPaid(tenantId: number, input: MarkArPaidInput, userId: number) {
  const data = await getAr(tenantId, input.id);
  const ar = data.ar;

  if (ar.status === 'paid' || ar.status === 'cancelled') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Conta já está com status ${ar.status}` });
  }

  const now = new Date();

  const [updatedAr] = await db.transaction(async (tx) => {
    const arUpdateData: Partial<typeof accountsReceivable.$inferInsert> & {
      status: 'paid';
      paidAt: Date;
      updatedAt: Date;
      notes: string | null;
    } = {
      status: 'paid',
      paidAt: now,
      notes: input.notes ? `${ar.notes || ''}\n[Pago]: ${input.notes}`.trim() : ar.notes,
      updatedAt: now,
    };
    if (input.paymentMethod !== undefined) arUpdateData.paymentMethod = input.paymentMethod;

    // 1. Atualiza AR
    const [updated] = await tx.update(accountsReceivable)
      .set(arUpdateData)
      .where(and(eq(accountsReceivable.tenantId, tenantId), eq(accountsReceivable.id, input.id)))
      .returning();
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conta a receber nao encontrada' });

    // 2. Insere Cashbook (AP-14)
    await tx.insert(cashbookEntries).values({
      tenantId,
      type: 'credit',
      amountCents: ar.amountCents,
      description: `Recebimento OS #${ar.jobId}`,
      category: 'pagamento_os',
      arId: ar.id,
      jobId: ar.jobId,
      clientId: ar.clientId,
      referenceDate: now,
      createdBy: userId,
    });

    return [updated];
  });

  logger.info({ action: 'financial.ar.paid', tenantId, arId: ar.id, amountCents: ar.amountCents }, 'Conta recebida + cashbook');
  return updatedAr;
}

export async function cancelAr(tenantId: number, input: CancelArInput, userId: number) {
  const data = await getAr(tenantId, input.id);
  const ar = data.ar;

  if (ar.status === 'paid') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não é possível cancelar uma conta já paga. Estorne o pagamento primeiro.' });
  }

  if (ar.status === 'cancelled') return ar;

  const [cancelled] = await db.update(accountsReceivable)
    .set({
      status: 'cancelled',
      cancelReason: input.cancelReason,
      cancelledBy: userId,
      updatedAt: new Date(),
    })
    .where(and(eq(accountsReceivable.tenantId, tenantId), eq(accountsReceivable.id, input.id)))
    .returning();

  logger.info({ action: 'financial.ar.cancelled', tenantId, arId: ar.id, reason: input.cancelReason }, 'Conta a receber cancelada');
  return cancelled;
}

// ─── AP (ACCOUNTS PAYABLE) ───────────────────────────────────────────────────

export async function createAp(tenantId: number, input: CreateApInput, userId: number) {
  const apData: typeof accountsPayable.$inferInsert = {
    tenantId,
    description: input.description,
    amountCents: input.amountCents,
    dueDate: new Date(input.dueDate),
    status: 'pending',
    createdBy: userId,
  };
  if (input.supplierId !== undefined) apData.supplierId = input.supplierId;
  if (input.supplier !== undefined) apData.supplier = input.supplier;
  if (input.category !== undefined) apData.category = input.category;
  if (input.issuedAt !== undefined) apData.issuedAt = new Date(input.issuedAt);
  if (input.reference !== undefined) apData.reference = input.reference;
  if (input.notes !== undefined) apData.notes = input.notes;

  const [ap] = await db.insert(accountsPayable).values(apData).returning();
  if (!ap) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao criar conta a pagar' });

  logger.info({ action: 'financial.ap.create', tenantId, apId: ap.id, amountCents: input.amountCents }, 'Conta a pagar criada');
  return ap;
}

export async function listAp(tenantId: number, filters: ListApInput) {
  const conditions = [eq(accountsPayable.tenantId, tenantId)];

  if (filters.status) conditions.push(eq(accountsPayable.status, filters.status));
  if (filters.cursor) conditions.push(gt(accountsPayable.id, filters.cursor));
  
  if (filters.dateFrom) conditions.push(sql`${accountsPayable.dueDate} >= ${new Date(filters.dateFrom)}`);
  if (filters.dateTo) conditions.push(sql`${accountsPayable.dueDate} <= ${new Date(filters.dateTo)}`);

  const data = await db
    .select()
    .from(accountsPayable)
    .where(and(...conditions))
    .orderBy(sql`${accountsPayable.id} DESC`)
    .limit(filters.limit + 1);

  const hasMore = data.length > filters.limit;
  const items = hasMore ? data.slice(0, filters.limit) : data;
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

  return { data: items, nextCursor };
}

export async function getAp(tenantId: number, apId: number) {
  const [ap] = await db.select().from(accountsPayable).where(and(eq(accountsPayable.tenantId, tenantId), eq(accountsPayable.id, apId)));
  if (!ap) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conta a pagar não encontrada' });
  return ap;
}

export async function markApPaid(tenantId: number, input: MarkApPaidInput, userId: number) {
  const ap = await getAp(tenantId, input.id);

  if (ap.status === 'paid' || ap.status === 'cancelled') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Conta já está com status ${ap.status}` });
  }

  const now = new Date();

  const [updatedAp] = await db.transaction(async (tx) => {
    const apUpdateData: Partial<typeof accountsPayable.$inferInsert> & {
      status: 'paid';
      paidAt: Date;
      updatedAt: Date;
      notes: string | null;
    } = {
      status: 'paid',
      paidAt: now,
      notes: input.notes ? `${ap.notes || ''}\n[Pago]: ${input.notes}`.trim() : ap.notes,
      updatedAt: now,
    };
    if (input.paymentMethod !== undefined) apUpdateData.paymentMethod = input.paymentMethod;

    // 1. Atualiza AP
    const [updated] = await tx.update(accountsPayable)
      .set(apUpdateData)
      .where(and(eq(accountsPayable.tenantId, tenantId), eq(accountsPayable.id, input.id)))
      .returning();
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Conta a pagar nao encontrada' });

    // 2. Insere Cashbook (AP-14)
    await tx.insert(cashbookEntries).values({
      tenantId,
      type: 'debit',
      amountCents: ap.amountCents,
      description: `Pagamento: ${ap.description}`,
      category: ap.category || 'fornecedor',
      apId: ap.id,
      referenceDate: now,
      createdBy: userId,
    });

    return [updated];
  });

  logger.info({ action: 'financial.ap.paid', tenantId, apId: ap.id, amountCents: ap.amountCents }, 'Conta paga + cashbook');
  return updatedAp;
}

export async function cancelAp(tenantId: number, input: CancelApInput, userId: number) {
  const ap = await getAp(tenantId, input.id);

  if (ap.status === 'paid') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não é possível cancelar uma conta já paga. Estorne o pagamento primeiro.' });
  }

  if (ap.status === 'cancelled') return ap;

  const [cancelled] = await db.update(accountsPayable)
    .set({
      status: 'cancelled',
      cancelReason: input.cancelReason,
      cancelledBy: userId,
      updatedAt: new Date(),
    })
    .where(and(eq(accountsPayable.tenantId, tenantId), eq(accountsPayable.id, input.id)))
    .returning();

  logger.info({ action: 'financial.ap.cancelled', tenantId, apId: ap.id, reason: input.cancelReason }, 'Conta a pagar cancelada');
  return cancelled;
}

// ─── FECHAMENTO (CLOSINGS) ───────────────────────────────────────────────────

export async function generateMonthlyClosing(tenantId: number, input: GenerateClosingInput, userId: number) {
  const [yearRaw = '0', monthRaw = '1'] = input.period.split('-');
  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const arConditions = [
    eq(accountsReceivable.tenantId, tenantId),
    sql`${accountsReceivable.dueDate} >= ${startDate}`,
    sql`${accountsReceivable.dueDate} <= ${endDate}`
  ];
  if (input.clientId) arConditions.push(eq(accountsReceivable.clientId, input.clientId));

  const ars = await db.select({
      ar: accountsReceivable,
      clientName: clients.name
    })
    .from(accountsReceivable)
    .leftJoin(clients, eq(accountsReceivable.clientId, clients.id))
    .where(and(...arConditions));

  let totalAmountCents = 0;
  let paidAmountCents = 0;
  let pendingAmountCents = 0;
  const clientMap = new Map<number, { name: string; totalOS: number; totalCents: number; paidCents: number; pendingCents: number }>();
  let totalJobsUnique = new Set<string>();

  for (const { ar, clientName } of ars) {
    if (ar.status !== 'cancelled') {
        totalAmountCents += ar.amountCents;
        if (ar.status === 'paid') paidAmountCents += ar.amountCents;
        else pendingAmountCents += ar.amountCents;

        const cId = ar.clientId;
        if (!clientMap.has(cId)) {
          clientMap.set(cId, { name: clientName || 'Desconhecido', totalOS: 0, totalCents: 0, paidCents: 0, pendingCents: 0 });
        }
        
        const cStat = clientMap.get(cId)!;
        cStat.totalCents += ar.amountCents;
        if (ar.status === 'paid') cStat.paidCents += ar.amountCents;
        else cStat.pendingCents += ar.amountCents;
        
        if (ar.jobId) {
            totalJobsUnique.add(ar.jobId.toString());
            cStat.totalOS += 1;
        }
    }
  }

  const breakdownJson = JSON.stringify(Array.from(clientMap.entries()).map(([id, data]) => ({ clientId: id, ...data })));

  const [closing] = await db.insert(financialClosings).values({
    tenantId,
    clientId: input.clientId || null,
    period: input.period,
    totalJobs: totalJobsUnique.size,
    totalAmountCents,
    paidAmountCents,
    pendingAmountCents,
    status: pendingAmountCents === 0 && totalAmountCents > 0 ? 'paid' : (totalAmountCents > 0 ? 'closed' : 'open'),
    breakdownJson,
    closedBy: userId,
    closedAt: new Date(),
  }).returning();
  if (!closing) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao gerar fechamento' });

  logger.info({ action: 'financial.closing.generate', tenantId, period: input.period, totalAmountCents }, 'Fechamento gerado');
  return closing;
}

export async function listClosings(tenantId: number, page: number = 1, limit: number = 20) {
  const result = await db.select().from(financialClosings)
    .where(eq(financialClosings.tenantId, tenantId))
    .orderBy(sql`${financialClosings.period} DESC`)
    .offset((page - 1) * limit)
    .limit(limit);
    
  const [countRow] = await db.select({ count: sql<number>`count(*)` })
    .from(financialClosings).where(eq(financialClosings.tenantId, tenantId));

  return { data: result, total: Number(countRow?.count ?? 0) };
}

export async function getClosing(tenantId: number, closingId: number) {
  const [closing] = await db.select().from(financialClosings)
    .where(and(eq(financialClosings.tenantId, tenantId), eq(financialClosings.id, closingId)));
  if (!closing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Fechamento não encontrado' });
  return closing;
}

// ─── LIVRO CAIXA (CASHBOOK) ──────────────────────────────────────────────────

export async function listCashbook(tenantId: number, filters: ListCashbookInput) {
  const conditions = [eq(cashbookEntries.tenantId, tenantId)];
  if (filters.type) conditions.push(eq(cashbookEntries.type, filters.type));
  if (filters.dateFrom) conditions.push(sql`${cashbookEntries.referenceDate} >= ${new Date(filters.dateFrom)}`);
  if (filters.dateTo) conditions.push(sql`${cashbookEntries.referenceDate} <= ${new Date(filters.dateTo)}`);

  const entries = await db.select()
    .from(cashbookEntries)
    .where(and(...conditions))
    .orderBy(sql`${cashbookEntries.referenceDate} DESC`)
    .offset((filters.page - 1) * filters.limit)
    .limit(filters.limit);

  const [countRow] = await db.select({ count: sql<number>`count(*)` })
    .from(cashbookEntries).where(and(...conditions));

  const balanceAgg = await db.select({
    type: cashbookEntries.type,
    total: sql<number>`sum(${cashbookEntries.amountCents})`
  }).from(cashbookEntries).where(and(...conditions)).groupBy(cashbookEntries.type);

  let totalCredits = 0;
  let totalDebits = 0;
  for (const row of balanceAgg) {
    if (row.type === 'credit') totalCredits = Number(row.total);
    if (row.type === 'debit') totalDebits = Number(row.total);
  }

  const netBalance = totalCredits - totalDebits;

  return { entries, balance: { totalCredits, totalDebits, netBalance }, total: Number(countRow?.count ?? 0) };
}

export async function createManualCashbookEntry(tenantId: number, input: CreateCashbookEntryInput, userId: number) {
  const [entry] = await db.insert(cashbookEntries).values({
    tenantId,
    type: input.type,
    amountCents: input.amountCents,
    description: input.description,
    category: input.category || 'manual',
    referenceDate: new Date(input.referenceDate),
    createdBy: userId,
  }).returning();
  
  logger.info({ action: 'financial.cashbook.manual_entry', tenantId, type: input.type, amountCents: input.amountCents }, 'Entrada manual no livro caixa cadastrada');
  return entry;
}

// ─── RELATÓRIOS (REPORTS) ────────────────────────────────────────────────────

export async function getAnnualBalance(tenantId: number, input: AnnualBalanceInput) {
  // 4 quarters: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
  const quarters = [
    { q: 1, revenue: 0, expenses: 0, profit: 0, margin: 0, startMonth: 0, endMonth: 2 },
    { q: 2, revenue: 0, expenses: 0, profit: 0, margin: 0, startMonth: 3, endMonth: 5 },
    { q: 3, revenue: 0, expenses: 0, profit: 0, margin: 0, startMonth: 6, endMonth: 8 },
    { q: 4, revenue: 0, expenses: 0, profit: 0, margin: 0, startMonth: 9, endMonth: 11 },
  ];

  const yearStart = new Date(input.year, 0, 1);
  const yearEnd = new Date(input.year, 11, 31, 23, 59, 59, 999);

  const paidArs = await db.select({ amount: accountsReceivable.amountCents, paidAt: accountsReceivable.paidAt })
    .from(accountsReceivable)
    .where(and(
      eq(accountsReceivable.tenantId, tenantId),
      eq(accountsReceivable.status, 'paid'),
      sql`${accountsReceivable.paidAt} >= ${yearStart}`,
      sql`${accountsReceivable.paidAt} <= ${yearEnd}`
    ));

  for (const ar of paidArs) {
    const month = ar.paidAt!.getMonth();
    const q = Math.floor(month / 3);
    if (quarters[q]) quarters[q].revenue += ar.amount;
  }

  const paidAps = await db.select({ amount: accountsPayable.amountCents, paidAt: accountsPayable.paidAt })
    .from(accountsPayable)
    .where(and(
      eq(accountsPayable.tenantId, tenantId),
      eq(accountsPayable.status, 'paid'),
      sql`${accountsPayable.paidAt} >= ${yearStart}`,
      sql`${accountsPayable.paidAt} <= ${yearEnd}`
    ));

  for (const ap of paidAps) {
    const month = ap.paidAt!.getMonth();
    const q = Math.floor(month / 3);
    if (quarters[q]) quarters[q].expenses += ap.amount;
  }

  for (const q of quarters) {
    q.profit = q.revenue - q.expenses;
    q.margin = q.revenue > 0 ? Number(((q.profit / q.revenue) * 100).toFixed(2)) : 0;
  }

  return { quarters: quarters.map(({ q, revenue, expenses, profit, margin }) => ({ q, revenue, expenses, profit, margin })) };
}

export async function getPayerRanking(tenantId: number, input: PayerRankingInput) {
  const conditions = [
    eq(accountsReceivable.tenantId, tenantId),
    eq(accountsReceivable.status, 'paid')
  ];
  if (input.dateFrom) conditions.push(sql`${accountsReceivable.paidAt} >= ${new Date(input.dateFrom)}`);
  if (input.dateTo) conditions.push(sql`${accountsReceivable.paidAt} <= ${new Date(input.dateTo)}`);

  const paidArs = await db.select({
      clientId: accountsReceivable.clientId,
      amountCents: accountsReceivable.amountCents,
      dueDate: accountsReceivable.dueDate,
      paidAt: accountsReceivable.paidAt,
      clientName: clients.name
    })
    .from(accountsReceivable)
    .leftJoin(clients, eq(accountsReceivable.clientId, clients.id))
    .where(and(...conditions));

  const stats = new Map<number, { clientName: string; totalPaidCents: number; totalCount: number; onTimeCount: number; lateCount: number }>();

  for (const ar of paidArs) {
    const cId = ar.clientId;
    if (!stats.has(cId)) {
      stats.set(cId, { clientName: ar.clientName || 'Desconhecido', totalPaidCents: 0, totalCount: 0, onTimeCount: 0, lateCount: 0 });
    }
    const stat = stats.get(cId)!;
    stat.totalPaidCents += ar.amountCents;
    stat.totalCount += 1;
    
    if (ar.paidAt! <= ar.dueDate) stat.onTimeCount += 1;
    else stat.lateCount += 1;
  }

  const result = Array.from(stats.entries()).map(([clientId, s]) => ({
    clientId,
    clientName: s.clientName,
    totalPaidCents: s.totalPaidCents,
    onTimePercent: s.totalCount > 0 ? Number(((s.onTimeCount / s.totalCount) * 100).toFixed(2)) : 0,
    lateCount: s.lateCount
  }));

  result.sort((a, b) => b.totalPaidCents - a.totalPaidCents);

  return result.slice(0, input.limit);
}

export async function getCashFlow(tenantId: number, input: CashFlowInput) {
  const startDate = new Date(input.dateFrom);
  const endDate = new Date(input.dateTo);

  const entries = await db.select()
    .from(cashbookEntries)
    .where(and(
      eq(cashbookEntries.tenantId, tenantId),
      sql`${cashbookEntries.referenceDate} >= ${startDate}`,
      sql`${cashbookEntries.referenceDate} <= ${endDate}`
    ));

  const monthsMap = new Map<string, { month: string; credits: number; debits: number; net: number }>();
  
  for (const entry of entries) {
    const monthKey = `${entry.referenceDate.getFullYear()}-${String(entry.referenceDate.getMonth() + 1).padStart(2, '0')}`;
    if (!monthsMap.has(monthKey)) {
      monthsMap.set(monthKey, { month: monthKey, credits: 0, debits: 0, net: 0 });
    }
    const m = monthsMap.get(monthKey)!;
    if (entry.type === 'credit') m.credits += entry.amountCents;
    else m.debits += entry.amountCents;
  }

  for (const m of monthsMap.values()) m.net = m.credits - m.debits;

  const [pendingCreditsRow] = await db.select({ pendingCredits: sql<number>`sum(${accountsReceivable.amountCents})` })
    .from(accountsReceivable)
    .where(and(eq(accountsReceivable.tenantId, tenantId), eq(accountsReceivable.status, 'pending')));

  const [pendingDebitsRow] = await db.select({ pendingDebits: sql<number>`sum(${accountsPayable.amountCents})` })
    .from(accountsPayable)
    .where(and(eq(accountsPayable.tenantId, tenantId), eq(accountsPayable.status, 'pending')));

  const months = Array.from(monthsMap.values()).sort((a, b) => a.month.localeCompare(b.month));

  return { 
    months, 
    projection: { 
      pendingCredits: Number(pendingCreditsRow?.pendingCredits || 0), 
      pendingDebits: Number(pendingDebitsRow?.pendingDebits || 0) 
    } 
  };
}

export async function getDashboardSummary(tenantId: number) {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [totalReceivableRow] = await db.select({ totalReceivable: sql<number>`sum(${accountsReceivable.amountCents})` })
    .from(accountsReceivable)
    .where(and(eq(accountsReceivable.tenantId, tenantId), eq(accountsReceivable.status, 'pending')));

  const [totalPayableRow] = await db.select({ totalPayable: sql<number>`sum(${accountsPayable.amountCents})` })
    .from(accountsPayable)
    .where(and(eq(accountsPayable.tenantId, tenantId), eq(accountsPayable.status, 'pending')));

  const [overdueCentsRow] = await db.select({ overdueCents: sql<number>`sum(${accountsReceivable.amountCents})` })
    .from(accountsReceivable)
    .where(and(eq(accountsReceivable.tenantId, tenantId), eq(accountsReceivable.status, 'overdue')));

  const monthEntries = await db.select({ type: cashbookEntries.type, amount: cashbookEntries.amountCents })
    .from(cashbookEntries)
    .where(and(
      eq(cashbookEntries.tenantId, tenantId),
      sql`${cashbookEntries.referenceDate} >= ${firstDayOfMonth}`,
      sql`${cashbookEntries.referenceDate} <= ${lastDayOfMonth}`
    ));

  let monthFlowCents = 0;
  for (const e of monthEntries) {
    if (e.type === 'credit') monthFlowCents += e.amount;
    else monthFlowCents -= e.amount;
  }

  return {
    totalReceivableCents: Number(totalReceivableRow?.totalReceivable || 0),
    totalPayableCents: Number(totalPayableRow?.totalPayable || 0),
    overdueCents: Number(overdueCentsRow?.overdueCents || 0),
    monthFlowCents
  };
}

// ─── PDFs (07.09, 07.11, 07.18) ──────────────────────────────────────────────

// Typed PDF document — avoids `any` while using jsPDF's output method
type JsPdfDoc = jsPDF & {
  output(type: 'arraybuffer'): ArrayBuffer;
  setFontSize(size: number): void;
  text(text: string, x: number, y: number, options?: { align?: string }): void;
};

export async function generateReceiptPdf(tenantId: number, arId: number): Promise<Buffer> {
  const data = await getAr(tenantId, arId);
  const ar = data.ar;
  if (ar.status !== 'paid') throw new TRPCError({ code: 'BAD_REQUEST', message: 'AR não está paga' });

  const doc = new jsPDF() as JsPdfDoc;
  doc.setFontSize(20);
  doc.text('Recibo de Pagamento', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Recibo Referente a OS #${ar.jobId}`, 20, 40);
  doc.text(`Cliente: ${data.clientName}`, 20, 50);
  doc.text(`Valor: R$ ${(ar.amountCents / 100).toFixed(2)}`, 20, 60);
  doc.text(`Data do Pagamento: ${ar.paidAt?.toLocaleDateString()}`, 20, 70);
  doc.text(`Método: ${ar.paymentMethod || 'N/A'}`, 20, 80);

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

export async function generateJobExtractPdf(tenantId: number, jobId: number): Promise<Buffer> {
  const doc = new jsPDF() as JsPdfDoc;
  doc.setFontSize(20);
  doc.text(`Extrato da OS #${jobId}`, 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text('Detalhamento financeiro da OS constando itens e ajustes.', 20, 40);
  
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

export async function generateClosingPdf(tenantId: number, closingId: number): Promise<Buffer> {
  const closing = await getClosing(tenantId, closingId);
  const doc = new jsPDF() as JsPdfDoc;
  doc.setFontSize(20);
  doc.text(`Fechamento - Periodo ${closing.period}`, 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Total OS: ${closing.totalJobs}`, 20, 40);
  doc.text(`Total Faturado: R$ ${(closing.totalAmountCents / 100).toFixed(2)}`, 20, 50);
  doc.text(`Total Pago: R$ ${(closing.paidAmountCents / 100).toFixed(2)}`, 20, 60);
  doc.text(`Total Pendente: R$ ${(closing.pendingAmountCents / 100).toFixed(2)}`, 20, 70);
  
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
