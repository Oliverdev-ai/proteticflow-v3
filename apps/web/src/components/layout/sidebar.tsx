import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, Columns3, DollarSign,
  Package, UserCog, BarChart3, Settings, Stethoscope, FileSpreadsheet, Truck,
  Coins, Scan, Calendar, Calculator,
} from 'lucide-react';
import { usePermissions } from '../../hooks/use-permissions';
import { useTenant } from '../../hooks/use-tenant';

const MENU_ITEMS = [
  { label: 'Dashboard',         icon: LayoutDashboard, href: '/',               module: 'dashboard' },
  { label: 'Clientes',          icon: Users,            href: '/clientes',       module: 'clients' },
  { label: 'Tabelas de Preços', icon: FileSpreadsheet,  href: '/precos',         module: 'pricing' },
  { label: 'Trabalhos',         icon: Briefcase,        href: '/trabalhos',      module: 'jobs' },
  { label: 'Kanban',            icon: Columns3,         href: '/kanban',         module: 'kanban' },
  { label: 'Scans 3D',          icon: Scan,             href: '/scans',          module: 'scans' },
  { label: 'Agenda',            icon: Calendar,         href: '/agenda',         module: 'agenda' },
  { label: 'Entregas',          icon: Truck,            href: '/entregas',       module: 'deliveries' },
  { label: 'Financeiro',        icon: DollarSign,       href: '/financeiro',     module: 'financial' },
  { label: 'Estoque',           icon: Package,          href: '/estoque',        module: 'inventory' },
  { label: 'Funcionários',      icon: UserCog,          href: '/funcionarios',   module: 'employees' },
  { label: 'Comissões',         icon: Coins,            href: '/comissoes',      module: 'commissions' },
  { label: 'Folha de Pagamento', icon: DollarSign,       href: '/payroll',        module: 'payroll' },
  { label: 'Relatórios',        icon: BarChart3,        href: '/relatorios',     module: 'reports' },
  { label: 'Simulador',         icon: Calculator,       href: '/simulador',      module: 'simulator' },
  { label: 'Configurações',     icon: Settings,         href: '/configuracoes',  module: 'settings' },
] as const;


export function Sidebar() {
  const { hasAccess } = usePermissions();
  const { current } = useTenant();

  return (
    <aside className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-neutral-800 flex items-center gap-2">
        <Stethoscope className="text-violet-500" size={22} />
        <span className="text-white font-semibold text-lg tracking-tight">ProteticFlow</span>
      </div>

      {/* Tenant name */}
      {current && (
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs text-neutral-500 uppercase tracking-widest">Laboratório</p>
          <p className="text-sm text-neutral-200 font-medium truncate">{current.name}</p>
        </div>
      )}

      {/* Nav links */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {MENU_ITEMS.filter(item => hasAccess(item.module)).map(item => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-violet-600 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`
            }
          >
            <item.icon size={17} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
