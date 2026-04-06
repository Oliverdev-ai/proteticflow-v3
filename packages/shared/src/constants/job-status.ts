// PRD 04.03 — Status machine para OS/Trabalhos
// 'overdue' é estado derivado (deadline < now), NÃO armazenado no banco

// JOB_STATUS mantido para retrocompatibilidade
export const JOB_STATUS = {
  PENDING:       'pending',
  IN_PROGRESS:   'in_progress',
  QUALITY_CHECK: 'quality_check',
  READY:         'ready',
  COMPLETED_WITH_REWORK: 'completed_with_rework',
  DELIVERED:     'delivered',
  CANCELLED:     'cancelled',
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

// Transições válidas — cancelled acessível de qualquer estado ativo
export const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  pending:       ['in_progress', 'cancelled'],
  in_progress:   ['quality_check', 'cancelled'],
  quality_check: ['ready', 'in_progress', 'cancelled'],  // pode voltar para produção
  ready:         ['delivered', 'completed_with_rework', 'cancelled'],
  completed_with_rework: [],
  delivered:     [],   // estado final
  cancelled:     [],   // estado final
};

// PAD-10: função pura, testável sem dependências externas
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  // cancelled acessível de QUALQUER estado exceto delivered e cancelled (já finais)
  if (to === 'cancelled' && from !== 'delivered' && from !== 'cancelled' && from !== 'completed_with_rework') return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// Labels PT-BR para UI / Kanban (05.03)
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  pending:       'Aguardando',
  in_progress:   'Em Produção',
  quality_check: 'Controle de Qualidade',
  ready:         'Concluído',
  completed_with_rework: 'Concluído c/ Remoldagem',
  delivered:     'Entregue',
  cancelled:     'Cancelado',
};

// Tailwind color token por status
export const JOB_STATUS_COLORS: Record<JobStatus, string> = {
  pending:       'slate',
  in_progress:   'blue',
  quality_check: 'amber',
  ready:         'green',
  completed_with_rework: 'amber',
  delivered:     'emerald',
  cancelled:     'red',
};

// Colunas do Kanban (05.01) — subset que aparece no board
export const KANBAN_COLUMNS: JobStatus[] = [
  'pending', 'in_progress', 'quality_check', 'ready', 'delivered',
];

// Etapas padrão para seed no onboarding (04.04)
export const DEFAULT_STAGES = [
  { name: 'Modelagem',     sortOrder: 1 },
  { name: 'Fundição',      sortOrder: 2 },
  { name: 'Cerâmica',      sortOrder: 3 },
  { name: 'Acabamento',    sortOrder: 4 },
  { name: 'Revisão Final', sortOrder: 5 },
] as const;
