import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as financialService from '../../financial/service.js';
import type { CommandPreview, ConfirmationStep, ToolContext } from '../tool-executor.js';

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

