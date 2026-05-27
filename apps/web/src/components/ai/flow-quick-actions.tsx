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
    <div className="rounded-lg border border-[var(--info)] bg-muted p-4">
      <p className="text-xs uppercase tracking-normal text-muted-foreground mb-3">Acoes rapidas Flow</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => void onAction(action.prompt)}
            disabled={disabled}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground text-left hover:border-[var(--info)] hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

