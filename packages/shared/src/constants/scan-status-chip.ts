import type { StatusChipVariant } from '../types/status-chip';

type ScanStatus = 'waiting' | 'sent' | 'printing' | 'completed' | 'error';

export const SCAN_STATUS_CHIP: Record<
  ScanStatus,
  { label: string; variant: StatusChipVariant }
> = {
  waiting: { label: 'Aguardando', variant: 'neutral' },
  sent: { label: 'Enviado', variant: 'info' },
  printing: { label: 'Imprimindo', variant: 'warning' },
  completed: { label: 'Concluido', variant: 'success' },
  error: { label: 'Erro', variant: 'destructive' },
};
