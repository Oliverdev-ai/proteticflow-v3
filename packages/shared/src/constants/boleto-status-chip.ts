import type { StatusChipVariant } from '../types/status-chip';

type BoletoStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';

export const BOLETO_STATUS_CHIP: Record<
  BoletoStatus,
  { label: string; variant: StatusChipVariant }
> = {
  pending: { label: 'Pendente', variant: 'neutral' },
  paid: { label: 'Pago', variant: 'success' },
  overdue: { label: 'Vencido', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'neutral' },
  refunded: { label: 'Estornado', variant: 'info' },
};
