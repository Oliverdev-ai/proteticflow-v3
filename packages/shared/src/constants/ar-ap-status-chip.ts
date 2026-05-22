import type { StatusChipVariant } from '../types/status-chip';

type ArApStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export const AR_AP_STATUS_CHIP: Record<
  ArApStatus,
  { label: string; variant: StatusChipVariant }
> = {
  pending: { label: 'Em aberto', variant: 'neutral' },
  paid: { label: 'Pago', variant: 'success' },
  overdue: { label: 'Vencido', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'neutral' },
};
