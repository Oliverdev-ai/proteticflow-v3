import type { Role } from '@proteticflow/shared';

type QuickActionsProps = {
  userRole: Role;
  disabled?: boolean;
  onAction: (prompt: string) => Promise<void>;
};

const FINANCIAL_ROLES: Role[] = ['superadmin', 'gerente', 'contabil'];

const ACTIONS = [
  { label: 'Trabalhos pendentes', prompt: 'Mostrar trabalhos pendentes' },
  { label: 'Entregas hoje', prompt: 'Listar entregas de hoje' },
  { label: 'Listar clientes', prompt: 'Listar clientes ativos' },
];

const ADMIN_ACTIONS = [
  { label: 'Relatório AR', prompt: 'Gerar relatório de contas a receber' },
  { label: 'Fechamento mensal', prompt: 'Gerar fechamento mensal' },
];

export function QuickActions({ userRole, disabled, onAction }: QuickActionsProps) {
  const canUseFinancial = FINANCIAL_ROLES.includes(userRole);
  const visibleActions = canUseFinancial ? [...ACTIONS, ...ADMIN_ACTIONS] : ACTIONS;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Quick Actions</p>
      <div className="flex flex-wrap gap-2">
        {visibleActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => void onAction(action.prompt)}
            disabled={disabled}
            className="px-3 py-1.5 text-xs rounded-lg border border-zinc-700 text-zinc-200 hover:border-primary hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
