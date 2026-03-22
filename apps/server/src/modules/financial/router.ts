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
    return service.createAr(ctx.tenant.id, input);
  }),

  listAr: tenantProcedure.input(listArSchema).query(({ input, ctx }) => {
    return service.listAr(ctx.tenant.id, input);
  }),

  getAr: tenantProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input, ctx }) => {
    return service.getAr(ctx.tenant.id, input.id);
  }),

  markArPaid: tenantProcedure.input(markArPaidSchema).mutation(({ input, ctx }) => {
    return service.markArPaid(ctx.tenant.id, input, ctx.user.id);
  }),

  cancelAr: adminProcedure.input(cancelArSchema).mutation(({ input, ctx }) => {
    return service.cancelAr(ctx.tenant.id, input, ctx.user.id);
  }),

  // ─── Contas a Pagar ──────────────────────────────────────────────────────────
  createAp: licensedProcedure.input(createApSchema).mutation(({ input, ctx }) => {
    return service.createAp(ctx.tenant.id, input, ctx.user.id);
  }),

  listAp: tenantProcedure.input(listApSchema).query(({ input, ctx }) => {
    return service.listAp(ctx.tenant.id, input);
  }),

  getAp: tenantProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input, ctx }) => {
    return service.getAp(ctx.tenant.id, input.id);
  }),

  markApPaid: tenantProcedure.input(markApPaidSchema).mutation(({ input, ctx }) => {
    return service.markApPaid(ctx.tenant.id, input, ctx.user.id);
  }),

  cancelAp: adminProcedure.input(cancelApSchema).mutation(({ input, ctx }) => {
    return service.cancelAp(ctx.tenant.id, input, ctx.user.id);
  }),

  // ─── Fechamento ─────────────────────────────────────────────────────────────
  generateClosing: adminProcedure.input(generateClosingSchema).mutation(({ input, ctx }) => {
    return service.generateMonthlyClosing(ctx.tenant.id, input, ctx.user.id);
  }),
  listClosings: tenantProcedure.input(
    z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(100).default(20) })
  ).query(({ input, ctx }) => {
    return service.listClosings(ctx.tenant.id, input.page, input.limit);
  }),
  getClosing: tenantProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input, ctx }) => {
    return service.getClosing(ctx.tenant.id, input.id);
  }),

  // ─── Livro Caixa ────────────────────────────────────────────────────────────
  listCashbook: tenantProcedure.input(listCashbookSchema).query(({ input, ctx }) => {
    return service.listCashbook(ctx.tenant.id, input);
  }),
  createEntry: adminProcedure.input(createCashbookEntrySchema).mutation(({ input, ctx }) => {
    return service.createManualCashbookEntry(ctx.tenant.id, input, ctx.user.id);
  }),

  // ─── Relatórios ──────────────────────────────────────────────────────────────
  annualBalance: tenantProcedure.input(annualBalanceSchema).query(({ input, ctx }) => {
    return service.getAnnualBalance(ctx.tenant.id, input);
  }),
  payerRanking: tenantProcedure.input(payerRankingSchema).query(({ input, ctx }) => {
    return service.getPayerRanking(ctx.tenant.id, input);
  }),
  cashFlow: tenantProcedure.input(cashFlowSchema).query(({ input, ctx }) => {
    return service.getCashFlow(ctx.tenant.id, input);
  }),
  dashboardSummary: tenantProcedure.query(({ ctx }) => {
    return service.getDashboardSummary(ctx.tenant.id);
  }),

  // ─── PDFs ───────────────────────────────────────────────────────────────────
  receiptPdf: tenantProcedure.input(z.object({ arId: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const buffer = await service.generateReceiptPdf(ctx.tenant.id, input.arId);
    return { base64: buffer.toString('base64') };
  }),
  jobExtractPdf: tenantProcedure.input(z.object({ jobId: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const buffer = await service.generateJobExtractPdf(ctx.tenant.id, input.jobId);
    return { base64: buffer.toString('base64') };
  }),
  closingPdf: tenantProcedure.input(z.object({ closingId: z.number().int().positive() })).query(async ({ input, ctx }) => {
    const buffer = await service.generateClosingPdf(ctx.tenant.id, input.closingId);
    return { base64: buffer.toString('base64') };
  }),
});
