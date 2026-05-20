import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Briefcase,
  Columns3,
  Calendar,
  Truck,
  Scan,
  Users,
  FileSpreadsheet,
  Calculator,
  DollarSign,
  Receipt,
  BarChart3,
  TrendingDown,
  UserCog,
  Banknote,
  Coins,
  Package,
  ShoppingCart,
  Settings,
  CreditCard,
  Headphones,
  Shield,
  Sparkles,
} from 'lucide-react';

export type NavItem = {
  label: string;
  href: string;
  module: string;
  icon: LucideIcon;
  keywords?: string[];
};

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

/** Item único no topo (fora dos grupos) */
export const NAV_DASHBOARD: NavItem = {
  label: 'Dashboard',
  href: '/',
  module: 'dashboard',
  icon: LayoutDashboard,
  keywords: ['inicio', 'kpi', 'resumo'],
};

/** 7 grupos colapsáveis — §5 do brief estratégico v1.3.0 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'operacional',
    label: 'Operacional',
    icon: Briefcase,
    items: [
      { label: 'Trabalhos',  href: '/trabalhos', module: 'jobs',       icon: Briefcase,  keywords: ['os', 'ordens'] },
      { label: 'Kanban',     href: '/kanban',    module: 'kanban',     icon: Columns3 },
      { label: 'Agenda',     href: '/agenda',    module: 'agenda',     icon: Calendar,   keywords: ['eventos'] },
      { label: 'Entregas',   href: '/entregas',  module: 'deliveries', icon: Truck,      keywords: ['roteiro'] },
      { label: 'Scans 3D',   href: '/scans',     module: 'scans',      icon: Scan,       keywords: ['stl', 'xml'] },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    icon: Users,
    items: [
      { label: 'Clientes',         href: '/clientes',  module: 'clients',   icon: Users,         keywords: ['clinicas', 'dentistas'] },
      { label: 'Tabela de Preços', href: '/precos',    module: 'pricing',   icon: FileSpreadsheet, keywords: ['preco', 'tabela'] },
      { label: 'Simulador',        href: '/simulador', module: 'simulator', icon: Calculator },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    items: [
      { label: 'Contas',      href: '/financeiro',             module: 'financial', icon: DollarSign,   keywords: ['receber', 'pagar', 'fluxo'] },
      { label: 'Fiscal',      href: '/fiscal/boletos',         module: 'fiscal',    icon: Receipt,      keywords: ['boleto', 'nfse'] },
      { label: 'Faturamento', href: '/relatorios/faturamento', module: 'reports',   icon: BarChart3,    keywords: ['fiscal', 'receita'] },
      { label: 'DRE',         href: '/relatorios/dre',         module: 'reports',   icon: TrendingDown, keywords: ['resultado'] },
      { label: 'Curva ABC',   href: '/relatorios/curva-abc',   module: 'reports',   icon: BarChart3,    keywords: ['pareto'] },
    ],
  },
  {
    id: 'equipe',
    label: 'Equipe',
    icon: UserCog,
    items: [
      { label: 'Funcionários',       href: '/funcionarios', module: 'employees',   icon: UserCog,  keywords: ['equipe'] },
      { label: 'Folha de Pagamento', href: '/payroll',      module: 'payroll',     icon: Banknote, keywords: ['holerite'] },
      { label: 'Comissões',          href: '/comissoes',    module: 'commissions', icon: Coins },
    ],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    icon: BarChart3,
    items: [
      { label: 'Relatórios', href: '/relatorios',          module: 'reports', icon: BarChart3,  keywords: ['pdf'] },
      { label: 'Despesas',   href: '/relatorios/despesas', module: 'reports', icon: TrendingDown, keywords: ['custos'] },
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    icon: Package,
    items: [
      { label: 'Materiais', href: '/estoque',  module: 'inventory', icon: Package,      keywords: ['materiais'] },
      { label: 'Compras',   href: '/compras',  module: 'inventory', icon: ShoppingCart, keywords: ['fornecedor', 'pedido', 'oc'] },
    ],
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    icon: Settings,
    items: [
      { label: 'Configurações', href: '/configuracoes',   module: 'settings', icon: Settings },
      { label: 'Plano',         href: '/planos',          module: 'settings', icon: CreditCard, keywords: ['assinatura'] },
      { label: 'Suporte',       href: '/suporte/tickets', module: 'support',  icon: Headphones, keywords: ['tickets', 'feedback'] },
      { label: 'Auditoria',     href: '/auditoria',       module: 'settings', icon: Shield },
    ],
  },
];

/** Flow IA — CTA destacado no rodapé do sidebar */
export const NAV_FLOW_IA: NavItem = {
  label: 'Flow IA',
  href: '/flow-ia',
  module: 'ai',
  icon: Sparkles,
  keywords: ['assistente', 'ia', 'voz'],
};

/** Lista plana de todos os itens (para busca global e compat legado) */
export const NAV_ALL_ITEMS: NavItem[] = [
  NAV_DASHBOARD,
  ...NAV_GROUPS.flatMap((g) => g.items),
  NAV_FLOW_IA,
  { label: 'IA Avançada', href: '/ia-avancada',       module: 'ai',      icon: Sparkles, keywords: ['predicao', 'previsao'] },
  { label: 'Sugestões',   href: '/suporte/sugestoes', module: 'support', icon: Headphones, keywords: ['feedback'] },
];

// Compat shim para código legado que usa NAV_ITEMS
export const NAV_ITEMS = NAV_ALL_ITEMS;

export { LayoutDashboard as NAV_ICON_FALLBACK };
export { Sparkles as NAV_FLOW_IA_ICON };
