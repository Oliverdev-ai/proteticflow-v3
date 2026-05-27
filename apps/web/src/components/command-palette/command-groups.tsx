import { Command } from 'cmdk';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  Home,
  Package,
  Percent,
  PlusCircle,
  Scan,
  Settings,
  Shield,
  ShoppingCart,
  Truck,
  UserRound,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { COMMAND_ITEM_CLASS } from './command-palette.constants';

type StaticCommand = {
  label: string;
  href: string;
  icon: LucideIcon;
  keywords?: string[];
};

type QuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  shortcut?: string;
};

const NAV_COMMANDS: StaticCommand[] = [
  { label: 'Dashboard', href: '/', icon: Home, keywords: ['inicio'] },
  { label: 'Trabalhos', href: '/trabalhos', icon: Briefcase, keywords: ['os'] },
  { label: 'Clientes', href: '/clientes', icon: Users },
  { label: 'Agenda', href: '/agenda', icon: Calendar },
  { label: 'Entregas', href: '/entregas', icon: Truck },
  { label: 'Estoque', href: '/estoque', icon: Package },
  { label: 'Compras', href: '/compras', icon: ShoppingCart },
  { label: 'Funcionarios', href: '/funcionarios', icon: UserRound },
  { label: 'Comissoes', href: '/comissoes', icon: Percent },
  { label: 'Financeiro', href: '/financeiro', icon: DollarSign },
  { label: 'Scans', href: '/scans', icon: Scan },
  { label: 'Relatorios', href: '/relatorios', icon: BarChart3 },
  { label: 'Auditoria', href: '/auditoria', icon: Shield },
  { label: 'Configuracoes', href: '/configuracoes', icon: Settings },
  { label: 'Fiscal', href: '/fiscal/boletos', icon: FileText },
];

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Nova Ordem de Servico', href: '/trabalhos/novo', icon: PlusCircle, shortcut: 'N O' },
  { label: 'Novo Cliente', href: '/clientes/novo', icon: PlusCircle, shortcut: 'N C' },
  { label: 'Novo Roteiro de Entrega', href: '/entregas', icon: PlusCircle, shortcut: 'N R' },
];

type CommandGroupsProps = {
  onSelect: () => void;
};

export function CommandGroups({ onSelect }: CommandGroupsProps) {
  const navigate = useNavigate();

  return (
    <>
      <Command.Group heading="Navegacao">
        {NAV_COMMANDS.map((command) => (
          <Command.Item
            key={command.href}
            value={`nav-${command.label}`}
            keywords={command.keywords ?? []}
            className={COMMAND_ITEM_CLASS}
            onSelect={() => {
              navigate(command.href);
              onSelect();
            }}
          >
            <command.icon className="h-4 w-4" />
            <span>{command.label}</span>
          </Command.Item>
        ))}
      </Command.Group>

      <Command.Separator className="my-1 h-px bg-[var(--border)]" />

      <Command.Group heading="Acoes Rapidas">
        {QUICK_ACTIONS.map((action) => (
          <Command.Item
            key={action.label}
            value={`quick-${action.label}`}
            className={COMMAND_ITEM_CLASS}
            onSelect={() => {
              navigate(action.href);
              onSelect();
            }}
          >
            <action.icon className="h-4 w-4" />
            <span className="flex-1">{action.label}</span>
            {action.shortcut ? (
              <span className="t-small text-[var(--fg-muted)]">{action.shortcut}</span>
            ) : null}
          </Command.Item>
        ))}
      </Command.Group>
    </>
  );
}
