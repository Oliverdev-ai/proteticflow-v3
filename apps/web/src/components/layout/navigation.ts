export type NavItem = {
  label: string;
  href: string;
  module: string;
  group?: 'financeiro';
  keywords?: string[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', module: 'dashboard', keywords: ['inicio', 'kpi'] },
  { label: 'Clientes', href: '/clientes', module: 'clients', keywords: ['clinicas'] },
  { label: 'Trabalhos', href: '/trabalhos', module: 'jobs', keywords: ['os', 'ordens'] },
  { label: 'Kanban', href: '/kanban', module: 'kanban' },
  { label: 'Scans 3D', href: '/scans', module: 'scans', keywords: ['stl', 'xml'] },
  { label: 'Agenda', href: '/agenda', module: 'agenda', keywords: ['eventos'] },
  { label: 'Entregas', href: '/entregas', module: 'deliveries', keywords: ['roteiro'] },
  { label: 'Financeiro', href: '/financeiro', module: 'financial', keywords: ['contas'] },
  { label: 'Tabelas de Precos', href: '/precos', module: 'pricing', group: 'financeiro', keywords: ['preco'] },
  { label: 'Comissoes', href: '/comissoes', module: 'commissions', group: 'financeiro' },
  { label: 'Folha de Pagamento', href: '/payroll', module: 'payroll', group: 'financeiro', keywords: ['holerite'] },
  { label: 'Fiscal', href: '/fiscal/boletos', module: 'fiscal', keywords: ['boleto', 'nfse'] },
  { label: 'Estoque', href: '/estoque', module: 'inventory', keywords: ['materiais'] },
  { label: 'Compras', href: '/compras', module: 'inventory', keywords: ['fornecedor', 'pedido', 'oc'] },
  { label: 'Funcionarios', href: '/funcionarios', module: 'employees', keywords: ['equipe'] },
  { label: 'Relatorios', href: '/relatorios', module: 'reports', keywords: ['pdf'] },
  { label: 'Faturamento', href: '/relatorios/faturamento', module: 'reports', keywords: ['fiscal', 'receita'] },
  { label: 'Despesas', href: '/relatorios/despesas', module: 'reports', keywords: ['fiscal', 'custos'] },
  { label: 'DRE', href: '/relatorios/dre', module: 'reports', keywords: ['resultado', 'dre'] },
  { label: 'Curva ABC', href: '/relatorios/curva-abc', module: 'reports', keywords: ['pareto', 'abc'] },
  { label: 'Simulador', href: '/simulador', module: 'simulator' },
  { label: 'Planos', href: '/planos', module: 'settings', keywords: ['assinatura'] },
  { label: 'Flow IA', href: '/flow-ia', module: 'ai', keywords: ['assistente'] },
  { label: 'IA Avancada', href: '/ia-avancada', module: 'ai', keywords: ['predicao'] },
  { label: 'Suporte', href: '/suporte/tickets', module: 'support', keywords: ['tickets'] },
  { label: 'Configuracoes', href: '/configuracoes', module: 'settings' },
  { label: 'Auditoria', href: '/auditoria', module: 'settings' },
];

