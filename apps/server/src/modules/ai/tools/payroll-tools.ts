import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as payrollService from '../../payroll/service.js';
import type { CommandPreview, ConfirmationStep, ToolContext } from '../tool-executor.js';

type PreviewStepResult = {
  step: ConfirmationStep;
  preview: CommandPreview;
  resolvedInput?: unknown;
};

export const payrollGenerateToolSchema = z.object({
  periodId: z.coerce.number().int().positive().optional(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export type PayrollGenerateToolInput = z.infer<typeof payrollGenerateToolSchema>;

function normalizePeriod(period: { year: number; month: number }): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

function parseYearMonth(period: string): { year: number; month: number } | null {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year, month };
}

export async function buildPayrollGeneratePreviewStep(
  ctx: ToolContext,
  input: PayrollGenerateToolInput,
): Promise<PreviewStepResult> {
  const periods = await payrollService.listPeriods(ctx.tenantId);

  if (periods.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Nao existem periodos de folha cadastrados para este tenant',
    });
  }

  const openPeriods = periods.filter((period) => period.status === 'open');
  const targetPool = openPeriods.length > 0 ? openPeriods : periods;

  let selected = input.periodId !== undefined
    ? targetPool.find((period) => period.id === input.periodId)
    : undefined;

  if (!selected && input.period) {
    const periodParts = parseYearMonth(input.period);
    if (periodParts) {
      selected = targetPool.find((period) =>
        period.year === periodParts.year && period.month === periodParts.month);
    }
  }

  if (!selected && targetPool.length === 1) {
    selected = targetPool[0];
  }

  if (!selected) {
    const preview: CommandPreview = {
      title: 'Selecionar periodo da folha',
      summary: 'Escolha o periodo que deve ser processado.',
      details: targetPool.slice(0, 5).map((period) => ({
        label: `Periodo #${period.id}`,
        value: `${normalizePeriod(period)} (${period.status})`,
      })),
    };

    return {
      step: {
        type: 'disambiguate',
        field: 'periodId',
        options: targetPool.slice(0, 20).map((period) => ({
          id: period.id,
          label: normalizePeriod(period),
          detail: `Status: ${period.status}`,
        })),
      },
      preview,
    };
  }

  if (selected.status !== 'open') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Periodo ${normalizePeriod(selected)} esta fechado para processamento`,
    });
  }

  const preview: CommandPreview = {
    title: 'Geracao de folha',
    summary: 'Revise o periodo antes de iniciar o processamento.',
    details: [
      { label: 'Periodo', value: normalizePeriod(selected) },
      { label: 'ID do periodo', value: String(selected.id) },
      { label: 'Status', value: selected.status },
      { label: 'Total bruto atual', value: `R$ ${(selected.totalGrossCents / 100).toFixed(2).replace('.', ',')}` },
    ],
  };

  return {
    step: {
      type: 'confirm',
      warning: 'A geracao consolida salarios e comissoes do periodo.',
      action: 'Confirmar geracao da folha',
      preview,
    },
    preview,
    resolvedInput: {
      periodId: selected.id,
    },
  };
}

export async function executePayrollGenerate(
  ctx: ToolContext,
  input: PayrollGenerateToolInput,
) {
  if (input.periodId === undefined) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'periodId e obrigatorio para gerar folha',
    });
  }

  return payrollService.generateEntries(ctx.tenantId, input.periodId, ctx.userId);
}

