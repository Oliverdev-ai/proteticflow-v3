import type { JobStatus } from './job-status';
import type { StatusChipVariant } from '../types/status-chip';

export const JOB_STATUS_CHIP: Record<JobStatus, { label: string; variant: StatusChipVariant }> = {
  pending: { label: 'Pendente', variant: 'neutral' },
  in_progress: { label: 'Em producao', variant: 'info' },
  quality_check: { label: 'Qualidade', variant: 'warning' },
  ready: { label: 'Pronto', variant: 'success' },
  delivered: { label: 'Entregue', variant: 'accent' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  rework_in_progress: { label: 'Retrabalho', variant: 'warning' },
  suspended: { label: 'Suspenso', variant: 'neutral' },
};
