type FlowQuickActionsProps = {
  disabled?: boolean;
  onAction: (prompt: string) => Promise<void>;
};

const QUICK_ACTIONS = [
  { label: 'Trabalhos pendentes', prompt: 'mostrar trabalhos pendentes' },
  { label: 'Entregas hoje', prompt: 'listar entregas de hoje' },
  { label: 'Buscar cliente', prompt: 'buscar cliente dr silva' },
  { label: 'Resumo do mes', prompt: 'resumo do mes' },
];

export function FlowQuickActions({ disabled, onAction }: FlowQuickActionsProps) {
  return (
    <div className="rounded-2xl border border-sky-900/40 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Acoes rapidas Flow</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => void onAction(action.prompt)}
            disabled={disabled}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-100 text-left hover:border-sky-500 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

