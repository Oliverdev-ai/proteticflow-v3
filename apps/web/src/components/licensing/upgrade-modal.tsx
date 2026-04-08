type UpgradePlan = 'starter' | 'pro' | 'enterprise';

type UpgradeModalProps = {
  open: boolean;
  targetPlan: UpgradePlan | null;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (plan: UpgradePlan) => void;
};

const PLAN_COPY: Record<UpgradePlan, { title: string; subtitle: string }> = {
  starter: {
    title: 'Upgrade para Starter',
    subtitle: 'Ideal para laboratorios pequenos que precisam de operacao previsivel.',
  },
  pro: {
    title: 'Upgrade para Pro',
    subtitle: 'Escala operacao com recursos avancados e limites ampliados.',
  },
  enterprise: {
    title: 'Upgrade para Enterprise',
    subtitle: 'Plano ilimitado para operacao com alta demanda e integracoes completas.',
  },
};

export function UpgradeModal({ open, targetPlan, isLoading, onClose, onConfirm }: UpgradeModalProps) {
  if (!open || !targetPlan) return null;

  const copy = PLAN_COPY[targetPlan];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">{copy.title}</h3>
        <p className="mt-2 text-sm text-zinc-400">{copy.subtitle}</p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(targetPlan)}
            disabled={isLoading}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary disabled:opacity-60"
          >
            {isLoading ? 'Redirecionando...' : 'Continuar para pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
