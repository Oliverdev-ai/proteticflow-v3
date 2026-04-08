import { PLAN_LIMITS, type PlanTier } from '@proteticflow/shared';

type UpgradePlan = 'starter' | 'pro' | 'enterprise';

type PlanComparisonTableProps = {
  currentPlan: PlanTier;
  onSelectPlan: (plan: UpgradePlan) => void;
  loadingPlan?: UpgradePlan | null | undefined;
};

const PLAN_ORDER: PlanTier[] = ['trial', 'starter', 'pro', 'enterprise'];
const PLAN_LABEL: Record<PlanTier, string> = {
  trial: 'Trial',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};
const PLAN_RANK: Record<PlanTier, number> = {
  trial: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

function formatLimit(value: number | null): string {
  if (value === null) return 'Ilimitado';
  return String(value);
}

function formatAiLabel(value: boolean | 'basic' | 'full') {
  if (value === false) return 'Nao';
  if (value === true) return 'Sim';
  if (value === 'basic') return 'Basico';
  return 'Completo';
}

export function PlanComparisonTable({ currentPlan, onSelectPlan, loadingPlan }: PlanComparisonTableProps) {
  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900 text-zinc-200">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Plano</th>
              <th className="px-4 py-3 text-left font-semibold">Clientes</th>
              <th className="px-4 py-3 text-left font-semibold">Jobs/mês</th>
              <th className="px-4 py-3 text-left font-semibold">Usuarios</th>
              <th className="px-4 py-3 text-left font-semibold">Tabelas de precos</th>
              <th className="px-4 py-3 text-left font-semibold">Portal</th>
              <th className="px-4 py-3 text-left font-semibold">IA</th>
              <th className="px-4 py-3 text-left font-semibold">API</th>
              <th className="px-4 py-3 text-right font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_ORDER.map((plan) => {
              const limits = PLAN_LIMITS[plan];
              const isCurrent = plan === currentPlan;
              const canCheckout =
                (plan === 'starter' || plan === 'pro' || plan === 'enterprise')
                && PLAN_RANK[plan] >= PLAN_RANK[currentPlan];

              return (
                <tr
                  key={plan}
                  className={isCurrent ? 'bg-emerald-950/30 border-y border-emerald-700/30' : 'bg-zinc-950'}
                >
                  <td className="px-4 py-3 text-zinc-100 font-medium">
                    {PLAN_LABEL[plan]}
                    {isCurrent ? <span className="ml-2 text-xs text-emerald-300">Atual</span> : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{formatLimit(limits.clients)}</td>
                  <td className="px-4 py-3 text-zinc-300">{formatLimit(limits.jobsPerMonth)}</td>
                  <td className="px-4 py-3 text-zinc-300">{formatLimit(limits.users)}</td>
                  <td className="px-4 py-3 text-zinc-300">{formatLimit(limits.priceTables)}</td>
                  <td className="px-4 py-3 text-zinc-300">{limits.features.portal ? 'Sim' : 'Nao'}</td>
                  <td className="px-4 py-3 text-zinc-300">{formatAiLabel(limits.features.ai)}</td>
                  <td className="px-4 py-3 text-zinc-300">{limits.features.api ? 'Sim' : 'Nao'}</td>
                  <td className="px-4 py-3 text-right">
                    {isCurrent ? (
                      <span className="inline-flex rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                        Em uso
                      </span>
                    ) : canCheckout && (plan === 'starter' || plan === 'pro' || plan === 'enterprise') ? (
                      <button
                        type="button"
                        onClick={() => onSelectPlan(plan)}
                        disabled={loadingPlan === plan}
                        className="rounded-md bg-primary hover:bg-primary disabled:opacity-60 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {loadingPlan === plan ? 'Abrindo...' : 'Assinar'}
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-500">Nao disponivel</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
