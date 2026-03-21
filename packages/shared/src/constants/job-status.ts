// Alinhado ao PRD 04.03: Recebido → Em Produção → Controle de Qualidade → Concluído → Entregue
// 'overdue' é estado derivado (deadline < now), calculado na query, não armazenado
export const JOB_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  QUALITY_CHECK: 'quality_check',
  READY: 'ready',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
