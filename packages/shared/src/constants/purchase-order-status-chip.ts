import type { StatusChipVariant } from '../types/status-chip';

type PurchaseOrderStatus = 'draft' | 'sent' | 'received' | 'cancelled';

export const PURCHASE_ORDER_STATUS_CHIP: Record<
  PurchaseOrderStatus,
  { label: string; variant: StatusChipVariant }
> = {
  draft: { label: 'Rascunho', variant: 'neutral' },
  sent: { label: 'Enviada', variant: 'info' },
  received: { label: 'Recebida', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
};
