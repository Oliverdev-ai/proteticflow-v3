// PRD 04.03 - Status machine para OS/Trabalhos
// 'overdue' e um estado derivado (deadline < now), nao armazenado no banco.

export const JOB_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  QUALITY_CHECK: 'quality_check',
  READY: 'ready',
  REWORK_IN_PROGRESS: 'rework_in_progress',
  SUSPENDED: 'suspended',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

// Transicoes do fluxo principal. Pausas operacionais usam mutations dedicadas.
export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['quality_check', 'cancelled'],
  quality_check: ['ready', 'in_progress', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  rework_in_progress: [],
  suspended: [],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  if (to === 'cancelled' && from !== 'delivered' && from !== 'cancelled') return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  pending: 'Aguardando',
  in_progress: 'Em Producao',
  quality_check: 'Controle de Qualidade',
  ready: 'Concluido',
  rework_in_progress: 'Em Remoldagem',
  suspended: 'Suspenso',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  pending: 'slate',
  in_progress: 'blue',
  quality_check: 'amber',
  ready: 'green',
  rework_in_progress: 'amber',
  suspended: 'slate',
  delivered: 'emerald',
  cancelled: 'red',
};

export const KANBAN_COLUMNS: JobStatus[] = [
  'pending',
  'in_progress',
  'quality_check',
  'ready',
  'rework_in_progress',
  'suspended',
  'delivered',
];

export const DEFAULT_STAGES = [
  { name: 'Modelagem', sortOrder: 1 },
  { name: 'Fundicao', sortOrder: 2 },
  { name: 'Ceramica', sortOrder: 3 },
  { name: 'Acabamento', sortOrder: 4 },
  { name: 'Revisao Final', sortOrder: 5 },
] as const;
