interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

const PLAN_NAMES = ['starter', 'pro', 'enterprise'] as const;

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 shadow-md flex flex-col gap-6">
        <h2 className="text-lg font-semibold uppercase tracking-normal">Faca Upgrade</h2>
        <p className="text-sm text-muted-foreground">
          Seu periodo promocional terminou. Escolha um plano para continuar usando o ProteticFlow.
        </p>

        <div className="grid grid-cols-3 gap-4">
          {PLAN_NAMES.map((plan) => (
            <a
              key={plan}
              href="/planos"
              className="rounded-xl border border-border p-4 flex flex-col gap-2 text-center hover:border-primary/50 transition-colors"
            >
              <span className="text-[10px] font-semibold uppercase tracking-normal">{plan}</span>
              <span className="text-xs text-muted-foreground">Ver detalhes</span>
            </a>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="self-end text-xs font-semibold uppercase tracking-normal text-muted-foreground"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
