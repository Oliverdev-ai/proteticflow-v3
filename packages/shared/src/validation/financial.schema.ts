import { z } from 'zod';

// Contas a Receber (07.01)
export const createArSchema = z.object({
  jobId: z.number().int().positive(),
  clientId: z.number().int().positive(),
  amountCents: z.number().int().min(1, 'Valor deve ser positivo'),
  description: z.string().max(512).optional(),
  dueDate: z.string().datetime(),
});

export const listArSchema = z.object({
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  clientId: z.number().int().positive().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  cursor: z.number().int().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const markArPaidSchema = z.object({
  id: z.number().int().positive(),
  paymentMethod: z.string().max(64).optional(),
  notes: z.string().optional(),
});

export const cancelArSchema = z.object({
  id: z.number().int().positive(),
  cancelReason: z.string().min(1, 'Motivo obrigatório'),
});

// Contas a Pagar (07.02)
export const createApSchema = z.object({
  description: z.string().min(1).max(512),
  supplierId: z.number().int().positive().optional(),
  supplier: z.string().max(255).optional(),
  category: z.string().max(128).optional(),
  amountCents: z.number().int().min(1, 'Valor deve ser positivo'),
  issuedAt: z.string().datetime().optional(),
  dueDate: z.string().datetime(),
  reference: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export const listApSchema = z.object({
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  cursor: z.number().int().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const markApPaidSchema = z.object({
  id: z.number().int().positive(),
  paymentMethod: z.string().max(64).optional(),
  notes: z.string().optional(),
});

export const cancelApSchema = z.object({
  id: z.number().int().positive(),
  cancelReason: z.string().min(1, 'Motivo obrigatório'),
});

// Fechamento (07.03, 07.18)
export const generateClosingSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Formato: YYYY-MM'),
  clientId: z.number().int().positive().optional(),
});

// Livro caixa (07.10)
export const listCashbookSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  type: z.enum(['credit', 'debit']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

export const createCashbookEntrySchema = z.object({
  type: z.enum(['credit', 'debit']),
  amountCents: z.number().int().min(1, 'Valor deve ser positivo'),
  description: z.string().min(1).max(512),
  category: z.string().max(128).optional(),
  referenceDate: z.string().datetime(),
});

// Fluxo de caixa (07.08)
export const cashFlowSchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
});

// Balanço anual (07.06)
export const annualBalanceSchema = z.object({
  year: z.number().int().min(2020).max(2100),
});

// Relatório de pagadores (07.07)
export const payerRankingSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
