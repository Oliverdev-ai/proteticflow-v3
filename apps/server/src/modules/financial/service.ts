import { eq, and, gt, lt, inArray, isNull, sql } from 'drizzle-orm';
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
  cancelApSchema
} from '@proteticflow/shared';

type CreateArInput = z.infer<typeof createArSchema>;
type ListArInput = z.infer<typeof listArSchema>;
type MarkArPaidInput = z.infer<typeof markArPaidSchema>;
type CancelArInput = z.infer<typeof cancelArSchema>;

type CreateApInput = z.infer<typeof createApSchema>;
type ListApInput = z.infer<typeof listApSchema>;
type MarkApPaidInput = z.infer<typeof markApPaidSchema>;
type CancelApInput = z.infer<typeof cancelApSchema>;

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ─── AR (ACCOUNTS RECEIVABLE) ────────────────────────────────────────────────

export async function createAr(tenantId: number, input: CreateArInput) {
  const [ar] = await db.insert(accountsReceivable).values({
    tenantId,
    jobId: input.jobId,
    clientId: input.clientId,
    amountCents: input.amountCents,
    description: input.description,
    dueDate: new Date(input.dueDate),
    status: 'pending',
  }).returning();

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
    // 1. Atualiza AR
    const [updated] = await tx.update(accountsReceivable)
      .set({ 
        status: 'paid', 
        paidAt: now, 
        paymentMethod: input.paymentMethod,
        notes: input.notes ? `${ar.notes || ''}\n[Pago]: ${input.notes}`.trim() : ar.notes,
        updatedAt: now
      })
      .where(and(eq(accountsReceivable.tenantId, tenantId), eq(accountsReceivable.id, input.id)))
      .returning();

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
  const [ap] = await db.insert(accountsPayable).values({
    tenantId,
    description: input.description,
    supplierId: input.supplierId,
    supplier: input.supplier,
    category: input.category,
    amountCents: input.amountCents,
    issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
    dueDate: new Date(input.dueDate),
    reference: input.reference,
    notes: input.notes,
    status: 'pending',
    createdBy: userId,
  }).returning();

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
    // 1. Atualiza AP
    const [updated] = await tx.update(accountsPayable)
      .set({ 
        status: 'paid', 
        paidAt: now, 
        paymentMethod: input.paymentMethod,
        notes: input.notes ? `${ap.notes || ''}\n[Pago]: ${input.notes}`.trim() : ap.notes,
        updatedAt: now
      })
      .where(and(eq(accountsPayable.tenantId, tenantId), eq(accountsPayable.id, input.id)))
      .returning();

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
