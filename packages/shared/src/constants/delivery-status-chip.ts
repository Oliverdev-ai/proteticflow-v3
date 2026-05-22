import type { StatusChipVariant } from '../types/status-chip';

type DeliveryStatus = 'scheduled' | 'in_transit' | 'delivered' | 'failed';

export const DELIVERY_STATUS_CHIP: Record<
  DeliveryStatus,
  { label: string; variant: StatusChipVariant }
> = {
  scheduled: { label: 'Agendada', variant: 'neutral' },
  in_transit: { label: 'Em rota', variant: 'info' },
  delivered: { label: 'Entregue', variant: 'success' },
  failed: { label: 'Falhou', variant: 'destructive' },
};
