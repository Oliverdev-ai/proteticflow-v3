import { NavLink } from 'react-router-dom';
import {
  Briefcase,
  Brain,
  Calculator,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Coins,
  Columns3,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  Headphones,
  LayoutDashboard,
  Package,
  Receipt,
  Scan,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Truck,
  UserCog,
  Users,
  BarChart3,
} from 'lucide-react';
import { usePermissions } from '../../hooks/use-permissions';
import { useTenant } from '../../hooks/use-tenant';
import { PlanBadge } from '../licensing/plan-badge';
import { NAV_ITEMS } from './navigation';

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
};

const ICONS = {
  '/': LayoutDashboard,
  '/clientes': Users,
  '/trabalhos': Briefcase,
  '/kanban': Columns3,
  '/scans': Scan,
  '/agenda': Calendar,
  '/entregas': Truck,
  '/financeiro': DollarSign,
  '/precos': FileSpreadsheet,
  '/comissoes': Coins,
  '/payroll': DollarSign,
  '/fiscal/boletos': Receipt,
  '/estoque': Package,
  '/compras': ShoppingCart,
  '/funcionarios': UserCog,
  '/relatorios': BarChart3,
  '/simulador': Calculator,
  '/planos': CreditCard,
  '/flow-ia': Sparkles,
  '/ia-avancada': Brain,
  '/suporte/tickets': Headphones,
  '/configuracoes': Settings,
  '/auditoria': Shield,
} as const;

function SidebarContent({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { hasAccess } = usePermissions();
  const { current } = useTenant();

  const rootItems = NAV_ITEMS.filter((item) => !item.group && hasAccess(item.module));
  const financeChildren = NAV_ITEMS.filter((item) => item.group === 'financeiro' && hasAccess(item.module));

  return (
    <aside
      className={`h-full bg-card border-r border-border flex flex-col transition-all duration-200 shadow-sm ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Stethoscope className="text-primary shrink-0" size={20} />
        {!collapsed && <span className="text-foreground font-semibold text-base tracking-tight">ProteticFlow</span>}
      </div>

      {current && !collapsed && (
        <div className="px-5 pt-4 pb-2">
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mb-1">Laboratório</p>
          <p className="text-sm text-foreground font-semibold truncate">{current.name}</p>
        </div>
      )}

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {rootItems.map((item) => {
          const Icon = ICONS[item.href as keyof typeof ICONS] ?? LayoutDashboard;
          const isDashboard = item.href === '/';
          return (
            <NavLink
              key={item.href}
              to={item.href}
              end={isDashboard}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`
              }
            >
              <Icon size={17} />
              {!collapsed && item.label}
            </NavLink>
          );
        })}

        {financeChildren.length > 0 && !collapsed && (
          <>
            <div className="pt-4 pb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
              Financeiro
            </div>
            {financeChildren.map((item) => {
              const Icon = ICONS[item.href as keyof typeof ICONS] ?? DollarSign;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-3 pl-6 pr-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`
                  }
                >
                  <Icon size={15} />
                  {item.label}
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-border space-y-3">
        <PlanBadge />
        {!collapsed && <p className="text-[11px] text-muted-foreground text-center">Powered by ProteticFlow</p>}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex w-full items-center justify-center gap-2 h-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && 'Recolher'}
        </button>
      </div>
    </aside>
  );
}

export function Sidebar({ collapsed, mobileOpen, onCloseMobile, onToggleCollapse }: SidebarProps) {
  return (
    <>
      <div className="hidden lg:block">
        <SidebarContent collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/50"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
          />
          <div className="absolute left-0 top-0 bottom-0 z-50">
            <SidebarContent collapsed={false} onToggleCollapse={onCloseMobile} />
          </div>
        </div>
      )}
    </>
  );
}

