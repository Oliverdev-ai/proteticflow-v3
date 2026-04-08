import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as purchaseService from '../../purchases/service.js';
import type { CommandPreview, ConfirmationStep, ToolContext } from '../tool-executor.js';

type PreviewStepResult = {
  step: ConfirmationStep;
  preview: CommandPreview;
  resolvedInput?: unknown;
};

export const purchasesReceiveToolSchema = z.object({
  purchaseId: z.coerce.number().int().positive().optional(),
  dueDate: z.string().datetime().optional(),
});

export type PurchasesReceiveToolInput = z.infer<typeof purchasesReceiveToolSchema>;

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function defaultDueDateIso(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

export async function buildPurchaseReceivePreviewStep(
  ctx: ToolContext,
  input: PurchasesReceiveToolInput,
): Promise<PreviewStepResult> {
  if (input.purchaseId === undefined) {
    const preview: CommandPreview = {
      title: 'Recebimento de compra',
      summary: 'Informe qual compra deve ser recebida.',
      details: [{ label: 'Campo necessario', value: 'ID da compra (purchaseId)' }],
    };

    return {
      step: {
        type: 'fill_missing',
        fields: [{
          name: 'purchaseId',
          label: 'ID da compra',
          type: 'number',
          required: true,
        }],
      },
      preview,
    };
  }

  const purchase = await purchaseService.getPurchase(ctx.tenantId, input.purchaseId);
  if (purchase.po.status !== 'sent') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Compra ${purchase.po.code} nao esta pronta para recebimento (status: ${purchase.po.status})`,
    });
  }

  const dueDate = input.dueDate ?? defaultDueDateIso();
  const preview: CommandPreview = {
    title: `Receber compra ${purchase.po.code}`,
    summary: 'Esta acao atualiza estoque e cria conta a pagar automaticamente.',
    details: [
      { label: 'Compra', value: purchase.po.code },
      { label: 'Fornecedor', value: purchase.supplierName ?? 'Nao informado' },
      { label: 'Itens', value: String(purchase.items.length) },
      { label: 'Total', value: formatCurrency(purchase.po.totalCents) },
      { label: 'Vencimento AP', value: new Date(dueDate).toLocaleDateString('pt-BR') },
    ],
  };

  return {
    step: {
      type: 'confirm',
      warning: 'A entrada em estoque e o lancamento financeiro serao efetivados ao confirmar.',
      action: 'Confirmar recebimento da compra',
      preview,
    },
    preview,
    resolvedInput: {
      purchaseId: purchase.po.id,
      dueDate,
    },
  };
}

export async function executePurchaseReceive(
  ctx: ToolContext,
  input: PurchasesReceiveToolInput,
) {
  if (input.purchaseId === undefined) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'purchaseId e obrigatorio para receber compra',
    });
  }

  return purchaseService.receivePurchase(
    ctx.tenantId,
    input.purchaseId,
    ctx.userId,
    input.dueDate ? new Date(input.dueDate) : undefined,
  );
}

