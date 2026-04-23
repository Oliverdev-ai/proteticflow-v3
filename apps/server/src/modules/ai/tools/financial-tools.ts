import { TRPCError } from '@trpc/server';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  financialExpensesToDateSchema,
  financialQuarterlyReportSchema,
  financialRevenueToDateSchema,
  type FinancialExpensesToDateInput,
  type FinancialQuarterlyReportInput,
  type FinancialRevenueToDateInput,
} from '@proteticflow/shared';
import { z } from 'zod';
import * as financialService from '../../financial/service.js';
import * as reportsService from '../../reports/service.js';
import { db } from '../../../db/index.js';
import { accountsPayable } from '../../../db/schema/financials.js';
import { clients } from '../../../db/schema/clients.js';
import { jobItems, jobs } from '../../../db/schema/jobs.js';
import type { CommandPreview, ConfirmationStep, ToolContext } from '../tool-executor.js';
import { resolvePeriod } from '../resolvers.js';

const closeAccountFallbackFields = [
  {
    name: 'id',
    label: 'ID da conta (AR)',
    type: 'number',
    required: false,
  },
  {
    name: 'clientId',
    label: 'ID do cliente',
    type: 'number',
    required: false,
  },
] as const;

type PreviewStepResult = {
  step: ConfirmationStep;
  preview: CommandPreview;
  resolvedInput?: unknown;
};

export const financialCloseAccountToolSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  clientId: z.coerce.number().int().positive().optional(),
  clientName: z.string().min(2).optional(),
  paymentMethod: z.string().max(64).optional(),
  notes: z.string().optional(),
});

export const financialMonthlyClosingToolSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  clientId: z.coerce.number().int().positive().optional(),
});

export type FinancialCloseAccountToolInput = z.infer<typeof financialCloseAccountToolSchema>;
export type FinancialMonthlyClosingToolInput = z.infer<typeof financialMonthlyClosingToolSchema>;
export type FinancialRevenueToDateToolInput = FinancialRevenueToDateInput;
export type FinancialExpensesToDateToolInput = FinancialExpensesToDateInput;
export type FinancialQuarterlyReportToolInput = FinancialQuarterlyReportInput;

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDueDate(value: Date): string {
  return value.toLocaleDateString('pt-BR');
}

function currentPeriod(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

function currentQuarterYear(base = new Date()): { quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'; year: number } {
  const quarter = `Q${Math.floor(base.getMonth() / 3) + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4';
  return { quarter, year: base.getFullYear() };
}

function quarterDateRange(quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4', year: number) {
  const quarterNumber = Number(quarter[1]);
  const startMonth = (quarterNumber - 1) * 3;
  const start = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { start, end };
}

function ensureQuarterNotFuture(quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4', year: number) {
  const now = new Date();
  const current = currentQuarterYear(now);
  const currentIndex = current.year * 10 + Number(current.quarter[1]);
  const requestedIndex = year * 10 + Number(quarter[1]);
  if (requestedIndex > currentIndex) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Nao e possivel gerar relatorio para trimestre futuro',
    });
  }
}

function buildCloseAccountPreview(
  accountId: number,
  clientName: string,
  dueDate: Date,
  amountCents: number,
): CommandPreview {
  return {
    title: 'Fechamento de conta a receber',
    summary: `Marcar AR #${accountId} como paga para ${clientName}.`,
    details: [
      { label: 'Conta', value: `AR #${accountId}` },
      { label: 'Cliente', value: clientName },
      { label: 'Vencimento', value: formatDueDate(dueDate) },
      { label: 'Valor', value: formatCurrency(amountCents) },
    ],
  };
}

export async function buildFinancialCloseAccountPreviewStep(
  ctx: ToolContext,
  input: FinancialCloseAccountToolInput,
): Promise<PreviewStepResult> {
  if (input.id !== undefined) {
    const account = await financialService.getAr(ctx.tenantId, input.id);
    if (account.ar.status === 'paid' || account.ar.status === 'cancelled') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Conta AR #${account.ar.id} nao pode ser fechada (status atual: ${account.ar.status})`,
      });
    }

    const preview = buildCloseAccountPreview(
      account.ar.id,
      account.clientName ?? 'Cliente',
      account.ar.dueDate,
      account.ar.amountCents,
    );

    return {
      step: {
        type: 'confirm',
        warning: 'Esta acao atualiza o financeiro e gera trilha de auditoria.',
        action: 'Confirmar fechamento da conta',
        preview,
      },
      preview,
      resolvedInput: {
        ...input,
        id: account.ar.id,
      },
    };
  }

  if (input.clientId === undefined) {
    const preview: CommandPreview = {
      title: 'Fechamento de conta a receber',
      summary: 'Informe a conta ou cliente para continuar.',
      details: [
        { label: 'Opcao 1', value: 'Preencher ID da conta (AR)' },
        { label: 'Opcao 2', value: 'Informar ID do cliente' },
      ],
    };

    return {
      step: {
        type: 'fill_missing',
        fields: [...closeAccountFallbackFields],
      },
      preview,
    };
  }

  const list = await financialService.listAr(ctx.tenantId, {
    status: 'pending',
    clientId: input.clientId,
    limit: 50,
  });

  if (list.data.length === 0) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Nenhuma conta pendente encontrada para este cliente',
    });
  }

  if (list.data.length === 1) {
    const single = list.data[0];
    const preview = buildCloseAccountPreview(
      single!.ar.id,
      single!.clientName ?? 'Cliente',
      single!.ar.dueDate,
      single!.ar.amountCents,
    );

    return {
      step: {
        type: 'confirm',
        warning: 'Esta acao atualiza o financeiro e gera trilha de auditoria.',
        action: 'Confirmar fechamento da conta',
        preview,
      },
      preview,
      resolvedInput: {
        ...input,
        id: single!.ar.id,
      },
    };
  }

  const preview: CommandPreview = {
    title: 'Selecionar conta para fechamento',
    summary: `Foram encontradas ${list.data.length} contas pendentes para o cliente informado.`,
    details: list.data.slice(0, 5).map((row) => ({
      label: `AR #${row.ar.id}`,
      value: `${formatCurrency(row.ar.amountCents)} - venc. ${formatDueDate(row.ar.dueDate)}`,
    })),
  };

  return {
    step: {
      type: 'disambiguate',
      field: 'id',
      options: list.data.slice(0, 20).map((row) => ({
        id: row.ar.id,
        label: `AR #${row.ar.id}`,
        detail: `${row.clientName ?? 'Cliente'} - ${formatCurrency(row.ar.amountCents)} - venc. ${formatDueDate(row.ar.dueDate)}`,
      })),
    },
    preview,
  };
}

export async function executeFinancialCloseAccount(
  ctx: ToolContext,
  input: FinancialCloseAccountToolInput,
) {
  if (input.id === undefined) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'ID da conta a receber e obrigatorio para fechar conta',
    });
  }

  return financialService.markArPaid(ctx.tenantId, {
    id: input.id,
    ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  }, ctx.userId);
}

export async function buildFinancialMonthlyClosingPreviewStep(
  ctx: ToolContext,
  input: FinancialMonthlyClosingToolInput,
): Promise<PreviewStepResult> {
  const period = input.period ?? currentPeriod();
  const dashboard = await financialService.getDashboardSummary(ctx.tenantId);
  const pending = await financialService.listAr(ctx.tenantId, {
    status: 'pending',
    limit: 100,
  });

  const preview: CommandPreview = {
    title: `Fechamento mensal ${period}`,
    summary: 'Revise os totais financeiros antes de fechar o periodo.',
    details: [
      { label: 'Periodo', value: period },
      { label: 'Recebiveis', value: formatCurrency(dashboard.totalReceivableCents) },
      { label: 'Pagaveis', value: formatCurrency(dashboard.totalPayableCents) },
      { label: 'Atrasos', value: formatCurrency(dashboard.overdueCents) },
      { label: 'Contas pendentes', value: String(pending.data.length) },
    ],
  };

  return {
    step: {
      type: 'confirm',
      warning: 'O fechamento consolida resultados do periodo selecionado.',
      action: 'Confirmar fechamento mensal',
      preview,
    },
    preview,
    resolvedInput: {
      ...input,
      period,
    },
  };
}

export async function executeFinancialMonthlyClosing(
  ctx: ToolContext,
  input: FinancialMonthlyClosingToolInput,
) {
  const period = input.period ?? currentPeriod();
  return financialService.generateMonthlyClosing(ctx.tenantId, {
    period,
    ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
  }, ctx.userId);
}

export async function executeFinancialRevenueToDate(
  ctx: ToolContext,
  input: FinancialRevenueToDateToolInput,
) {
  const parsed = financialRevenueToDateSchema.parse(input);
  const period = resolvePeriod({
    period: parsed.period,
    startDate: parsed.startDate ?? null,
    endDate: parsed.endDate ?? null,
  });

  const deliveredConditions = [
    eq(jobs.tenantId, ctx.tenantId),
    eq(jobs.status, 'delivered'),
    gte(jobs.deliveredAt, new Date(period.startDate)),
    lte(jobs.deliveredAt, new Date(period.endDate)),
  ];

  const [summary] = await db
    .select({
      deliveredJobs: sql<number>`count(*)`,
      totalRevenueCents: sql<number>`coalesce(sum(${jobs.totalCents}), 0)`,
    })
    .from(jobs)
    .where(and(...deliveredConditions));

  let breakdown: Array<Record<string, unknown>> = [];

  if (parsed.breakdown === 'by_client') {
    const grouped = await db
      .select({
        clientId: clients.id,
        clientName: clients.name,
        revenueCents: sql<number>`coalesce(sum(${jobs.totalCents}), 0)`,
        jobsCount: sql<number>`count(*)`,
      })
      .from(jobs)
      .leftJoin(clients, and(
        eq(clients.id, jobs.clientId),
        eq(clients.tenantId, ctx.tenantId),
      ))
      .where(and(...deliveredConditions))
      .groupBy(clients.id, clients.name)
      .orderBy(desc(sql`coalesce(sum(${jobs.totalCents}), 0)`))
      .limit(10);

    breakdown = grouped.map((row) => ({
      clientId: row.clientId,
      clientName: row.clientName ?? 'Cliente removido',
      revenueCents: Number(row.revenueCents ?? 0),
      jobsCount: Number(row.jobsCount ?? 0),
    }));
  }

  if (parsed.breakdown === 'by_service') {
    const grouped = await db
      .select({
        serviceName: jobItems.serviceNameSnapshot,
        revenueCents: sql<number>`coalesce(sum(${jobItems.totalCents}), 0)`,
        itemsCount: sql<number>`count(*)`,
      })
      .from(jobItems)
      .innerJoin(jobs, and(
        eq(jobs.id, jobItems.jobId),
        eq(jobs.tenantId, ctx.tenantId),
      ))
      .where(and(...deliveredConditions))
      .groupBy(jobItems.serviceNameSnapshot)
      .orderBy(desc(sql`coalesce(sum(${jobItems.totalCents}), 0)`))
      .limit(10);

    breakdown = grouped.map((row) => ({
      serviceName: row.serviceName,
      revenueCents: Number(row.revenueCents ?? 0),
      itemsCount: Number(row.itemsCount ?? 0),
    }));
  }

  return {
    status: 'ok',
    period,
    deliveredJobs: Number(summary?.deliveredJobs ?? 0),
    totalRevenueCents: Number(summary?.totalRevenueCents ?? 0),
    breakdownType: parsed.breakdown,
    breakdown,
  };
}

export async function executeFinancialExpensesToDate(
  ctx: ToolContext,
  input: FinancialExpensesToDateToolInput,
) {
  const parsed = financialExpensesToDateSchema.parse(input);
  const period = resolvePeriod({
    period: parsed.period,
    startDate: parsed.startDate ?? null,
    endDate: parsed.endDate ?? null,
  });

  const conditions = [
    eq(accountsPayable.tenantId, ctx.tenantId),
    eq(accountsPayable.status, 'paid'),
    gte(accountsPayable.paidAt, new Date(period.startDate)),
    lte(accountsPayable.paidAt, new Date(period.endDate)),
  ];

  const [summary] = await db
    .select({
      paidCount: sql<number>`count(*)`,
      totalExpensesCents: sql<number>`coalesce(sum(${accountsPayable.amountCents}), 0)`,
    })
    .from(accountsPayable)
    .where(and(...conditions));

  const breakdown = parsed.breakdown === 'by_category'
    ? await db
      .select({
        category: accountsPayable.category,
        totalCents: sql<number>`coalesce(sum(${accountsPayable.amountCents}), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(accountsPayable)
      .where(and(...conditions))
      .groupBy(accountsPayable.category)
      .orderBy(desc(sql`coalesce(sum(${accountsPayable.amountCents}), 0)`))
      .limit(10)
    : [];

  return {
    status: 'ok',
    period,
    paidExpenses: Number(summary?.paidCount ?? 0),
    totalExpensesCents: Number(summary?.totalExpensesCents ?? 0),
    breakdownType: parsed.breakdown,
    breakdown: breakdown.map((row) => ({
      category: row.category ?? 'sem_categoria',
      totalCents: Number(row.totalCents ?? 0),
      count: Number(row.count ?? 0),
    })),
  };
}

export async function executeFinancialQuarterlyReport(
  ctx: ToolContext,
  input: FinancialQuarterlyReportToolInput,
) {
  const parsed = financialQuarterlyReportSchema.parse(input);
  const nowQuarter = currentQuarterYear();
  const quarter = parsed.quarter ?? nowQuarter.quarter;
  const year = parsed.year ?? nowQuarter.year;

  ensureQuarterNotFuture(quarter, year);
  const range = quarterDateRange(quarter, year);

  const filters = {
    dateFrom: range.start.toISOString(),
    dateTo: range.end.toISOString(),
    groupBy: 'quarter' as const,
    includeCharts: false,
    includeBreakdownByClient: true,
  };

  if (parsed.exportFormat === 'pdf') {
    const pdf = await reportsService.generatePdf(
      ctx.tenantId,
      'quarterly_annual',
      filters,
      ctx.role,
      `Balanco ${quarter}/${year}`,
    );
    return {
      status: 'ok',
      quarter,
      year,
      format: 'pdf',
      file: pdf,
    };
  }

  if (parsed.exportFormat === 'xlsx') {
    const csv = await reportsService.exportCsv(
      ctx.tenantId,
      'quarterly_annual',
      filters,
      ctx.role,
    );
    return {
      status: 'ok',
      quarter,
      year,
      format: 'csv',
      note: 'Exportacao xlsx ainda indisponivel; retornado CSV compativel.',
      file: csv,
    };
  }

  const preview = await reportsService.preview(
    ctx.tenantId,
    'quarterly_annual',
    filters,
    ctx.role,
  );

  return {
    status: 'ok',
    quarter,
    year,
    format: 'inline',
    report: preview,
  };
}
