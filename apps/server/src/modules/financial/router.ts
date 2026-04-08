import { router, tenantProcedure, licensedProcedure, adminProcedure } from '../../trpc/trpc.js';
import { z } from 'zod';
import {
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
  annualBalanceSchema,
  payerRankingSchema,
  cashFlowSchema
} from '@proteticflow/shared';

import * as service from './service.js';

export const financialRouter = router({
  // ─── Contas a Receber ────────────────────────────────────────────────────────
  createAr: licensedProcedure.input(createArSchema).mutation(({ input, ctx }) => {
    return service.createAr(ctx.tenantId!, input);
  }),

  listAr: tenantProcedure.input(listArSchema).query(({ input, ctx }) => {
    return service.listAr(ctx.tenantId!, input);
  }),

  getAr: tenantProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input, ctx }) => {
    return service.getAr(ctx.tenantId!, input.id);
  }),

  markArPaid: tenantProcedure.input(markArPaidSchema).mutation(({ input, ctx }) => {
    return service.markArPaid(ctx.tenantId!, input, ctx.user!.id);
  }),

  cancelAr: adminProcedure.input(cancelArSchema).mutation(({ input, ctx }) => {
    return service.cancelAr(ctx.tenantId!, input, ctx.user!.id);
  }),

  // ─── Contas a Pagar ──────────────────────────────────────────────────────────
  createAp: licensedProcedure.input(createApSchema).mutation(({ input, ctx }) => {
    return service.createAp(ctx.tenantId!, input, ctx.user!.id);
  }),

  listAp: tenantProcedure.input(listApSchema).query(({ input, ctx }) => {
    return service.listAp(ctx.tenantId!, input);
  }),

  getAp: tenantProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input, ctx }) => {
    return service.getAp(ctx.tenantId!, input.id);
  }),

  markApPaid: tenantProcedure.input(markApPaidSchema).mutation(({ input, ctx }) => {
    return service.markApPaid(ctx.tenantId!, input, ctx.user!.id);
  }),

  cancelAp: adminProcedure.input(cancelApSchema).mutation(({ input, ctx }) => {
    return service.cancelAp(ctx.tenantId!, input, ctx.user!.id);
  }),

  // ─── Fechamento ─────────────────────────────────────────────────────────────
  generateClosing: adminProcedure.input(generateClosingSchema).mutation(({ input, ctx }) => {
    return service.generateMonthlyClosing(ctx.tenantId!, input, ctx.user!.id);
  }),
  listClosings: tenantProcedure.input(
    z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(100).default(20) })
  ).query(({ input, ctx }) => {
    return service.listClosings(ctx.tenantId!, input.page, input.limit);
  }),
  getClosing: tenantProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input, ctx }) => {
    return service.getClosing(ctx.tenantId!, input.id);
  }),

  // ─── Livro Caixa ────────────────────────────────────────────────────────────
  listCashbook: tenantProcedure.input(listCashbookSchema).query(({ input, ctx }) => {
    return service.listCashbook(ctx.tenantId!, input);
  }),
  createEntry: adminProcedure.input(createCashbookEntrySchema).mutation(({ input, ctx }) => {
    return service.createManualCashbookEntry(ctx.tenantId!, input, ctx.user!.id);
  }),

  // ─── Relatórios ──────────────────────────────────────────────────────────────
  annualBalance: tenantProcedure.input(annualBalanceSchema).query(({ input, ctx }) => {
    return service.getAnnualBalance(ctx.tenantId!, input);
  }),
  payerRanking: tenantProcedure.input(payerRankingSchema).query(({ input, ctx }) => {
    return service.getPayerRanking(ctx.tenantId!, input);
  }),
  cashFlow: tenantProcedure.input(cashFlowSchema).query(({ input, ctx }) => {
    return service.getCashFlow(ctx.tenantId!, input);
  }),
  dashboardSummary: tenantProcedure.query(({ ctx }) => {
    return service.getDashboardSummary(ctx.tenantId!);
  }),

  // ─── PDFs ───────────────────────────────────────────────────────────────────
  receiptPdf: tenantProcedure.input(z.object({ arId: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const buffer = await service.generateReceiptPdf(ctx.tenantId!, input.arId);
    return { base64: buffer.toString('base64') };
  }),
  jobExtractPdf: tenantProcedure.input(z.object({ jobId: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const buffer = await service.generateJobExtractPdf(ctx.tenantId!, input.jobId);
    return { base64: buffer.toString('base64') };
  }),
  closingPdf: tenantProcedure.input(z.object({ closingId: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const buffer = await service.generateClosingPdf(ctx.tenantId!, input.closingId);
    return { base64: buffer.toString('base64') };
  }),
});

