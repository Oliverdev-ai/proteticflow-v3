import { trpc } from '../../lib/trpc';

function getTrialDaysRemaining(planExpiresAt: string | null) {
  if (!planExpiresAt) return 0;
  const expires = new Date(planExpiresAt).getTime();
  const now = Date.now();
  const diff = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 0);
}

function formatPlan(plan: string) {
  if (plan === 'trial') return 'Trial';
  if (plan === 'starter') return 'Starter';
  if (plan === 'pro') return 'Pro';
  if (plan === 'enterprise') return 'Enterprise';
  return plan;
}

export function PlanBadge() {
  const statusQuery = trpc.licensing.getStatus.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });

  const status = statusQuery.data;
  if (!status) {
    return (
      <div className="mx-2 mb-3 rounded-lg border border-neutral-800 bg-neutral-900/70 px-3 py-2">
        <p className="text-[11px] uppercase tracking-wider text-neutral-500">Plano</p>
        <p className="text-sm text-neutral-300">Carregando...</p>
      </div>
    );
  }

  const daysRemaining = getTrialDaysRemaining(status.planExpiresAt);
  const isExpiring = status.plan === 'trial' && !status.trialExpired && daysRemaining <= 7;
  const containerClass = status.trialExpired
    ? 'border-red-700/60 bg-red-950/40'
    : isExpiring
      ? 'border-amber-700/60 bg-amber-950/30'
      : 'border-neutral-800 bg-neutral-900/70';

  return (
    <div className={`mx-2 mb-3 rounded-lg px-3 py-2 border ${containerClass}`}>
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">Plano</p>
      <p className="text-sm font-medium text-neutral-100">
        {formatPlan(status.plan)}
        {status.plan === 'trial' ? (
          <span className="ml-1 text-xs text-neutral-400">
            ({status.trialExpired ? 'expirado' : `${daysRemaining} dias`})
          </span>
        ) : null}
      </p>
    </div>
  );
}
