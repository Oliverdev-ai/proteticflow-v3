import type { ReportDefinition } from '@proteticflow/shared';

const FISCAL_DEPENDENCY_NOTE =
  'Dependente das Fases 24-25 (boletos e NFS-e). Retorna NOT_IMPLEMENTED nesta fase.';

export const reportRegistry: ReportDefinition[] = [
  {
    type: 'monthly_closing',
    title: 'Fechamento Mensal',
    description: 'Resumo financeiro mensal com breakdown por cliente.',
    outputKind: 'mixed',
    supportsPdf: true,
    supportsCsv: true,
    supportsEmail: true,
    enabled: true,
  },
  {
    type: 'jobs_by_period',
    title: 'Trabalhos por Periodo',
    description: 'Lista de OS por periodo com filtros de data.',
    outputKind: 'table',
    supportsPdf: true,
    supportsCsv: true,
    supportsEmail: true,
    enabled: true,
  },
  {
    type: 'productivity',
    title: 'Produtividade por Tecnico',
    description: 'OS concluidas, tempo medio e taxa de atraso por tecnico.',
    outputKind: 'table',
    supportsPdf: true,
    supportsCsv: true,
    supportsEmail: true,
    enabled: true,
  },
  {
    type: 'quarterly_annual',
    title: 'Consolidado Trimestral/Anual',
    description: 'Consolidado por periodo com indicadores e graficos.',
    outputKind: 'mixed',
    supportsPdf: true,
    supportsCsv: true,
    supportsEmail: true,
    enabled: true,
  },
  {
    type: 'inventory',
    title: 'Relatorio de Estoque',
    description: 'Posicao atual, movimentacoes e alertas de estoque.',
    outputKind: 'table',
    supportsPdf: true,
    supportsCsv: true,
    supportsEmail: true,
    enabled: true,
  },
  {
    type: 'deliveries',
    title: 'Relatorio de Entregas',
    description: 'Entregas realizadas/falhas e tempo medio por rota.',
    outputKind: 'table',
    supportsPdf: true,
    supportsCsv: true,
    supportsEmail: true,
    enabled: true,
  },
  {
    type: 'purchases',
    title: 'Relatorio de Compras',
    description: 'Ordens de compra por periodo e fornecedor.',
    outputKind: 'table',
    supportsPdf: true,
    supportsCsv: true,
    supportsEmail: true,
    enabled: true,
  },
  {
    type: 'fiscal',
    title: 'Relatorio Fiscal',
    description: 'NFS-e e boletos por periodo.',
    outputKind: 'table',
    supportsPdf: false,
    supportsCsv: false,
    supportsEmail: false,
    enabled: false,
    dependencyNote: FISCAL_DEPENDENCY_NOTE,
  },
];

export function getReportDefinition(type: ReportDefinition['type']) {
  return reportRegistry.find((report) => report.type === type) ?? null;
}
