import type { StatusChipVariant } from '../types/status-chip';

type InvoiceStatus = 'draft' | 'pending' | 'issued' | 'cancelled' | 'error';

export const INVOICE_STATUS_CHIP: Record<
  InvoiceStatus,
  { label: string; variant: StatusChipVariant }
> = {
  draft: { label: 'Rascunho', variant: 'neutral' },
  pending: { label: 'Pendente', variant: 'neutral' },
  issued: { label: 'Emitida', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
  error: { label: 'Erro', variant: 'destructive' },
};
