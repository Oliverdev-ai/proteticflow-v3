import { useMemo, useState } from 'react';
import type { PlanTier } from '@proteticflow/shared';
import { trpc } from '../../lib/trpc';
import { PlanComparisonTable } from '../../components/licensing/plan-comparison-table';
import { UpgradeModal } from '../../components/licensing/upgrade-modal';

type UpgradePlan = 'starter' | 'pro' | 'enterprise';

function formatPlan(plan: PlanTier) {
  if (plan === 'trial') return 'Trial';
  if (plan === 'starter') return 'Starter';
  if (plan === 'pro') return 'Pro';
  return 'Enterprise';
}

export default function PlanosPage() {
  const statusQuery = trpc.licensing.getStatus.useQuery();
  const checkoutMutation = trpc.licensing.createCheckoutSession.useMutation();
  const billingPortalMutation = trpc.licensing.createBillingPortalSession.useMutation();
  const [targetPlan, setTargetPlan] = useState<UpgradePlan | null>(null);

  const status = statusQuery.data;
  const isLoading = checkoutMutation.isPending || billingPortalMutation.isPending;

  const usageCards = useMemo(() => {
    if (!status) return [];
    return [
      {
        label: 'Clientes',
        current: status.usage.clients.current,
        limit: status.usage.clients.limit,
        percent: status.usage.clients.usagePercent,
      },
      {
        label: 'Jobs/mês',
        current: status.usage.jobsPerMonth.current,
        limit: status.usage.jobsPerMonth.limit,
        percent: status.usage.jobsPerMonth.usagePercent,
      },
      {
        label: 'Usuários',
        current: status.usage.users.current,
        limit: status.usage.users.limit,
        percent: status.usage.users.usagePercent,
      },
      {
        label: 'Tabelas de preços',
        current: status.usage.priceTables.current,
        limit: status.usage.priceTables.limit,
        percent: status.usage.priceTables.usagePercent,
      },
    ];
  }, [status]);

  async function handleCheckout(plan: UpgradePlan) {
    const successUrl = `${window.location.origin}/planos?checkout=success`;
    const cancelUrl = `${window.location.origin}/planos?checkout=cancel`;

    const result = await checkoutMutation.mutateAsync({
      planTier: plan,
      successUrl,
      cancelUrl,
    });

    window.location.href = result.url;
  }

  async function handleOpenBillingPortal() {
    const result = await billingPortalMutation.mutateAsync();
    window.location.href = result.url;
  }

  if (statusQuery.isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Planos e Licenciamento</h1>
        <p className="text-sm text-zinc-400">Carregando informacoes de assinatura...</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Planos e Licenciamento</h1>
        <p className="text-sm text-red-400">Não foi possível carregar os dados de licença.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Planos e Licenciamento</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Plano atual:{' '}
            <span className="text-zinc-100 font-medium">{formatPlan(status.plan)}</span>
          </p>
          {status.plan === 'trial' ? (
            <p className="text-xs text-zinc-500 mt-1">
              Trial {status.trialExpired ? 'expirado' : 'ativo'}.
            </p>
          ) : null}
        </div>

        {status.plan !== 'trial' ? (
          <button
            type="button"
            onClick={handleOpenBillingPortal}
            disabled={isLoading}
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-60"
          >
            Gerenciar cobrança
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {usageCards.map((item) => (
          <div key={item.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">{item.label}</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {item.current}
              <span className="text-sm text-zinc-400">
                {' '}
                / {item.limit === null ? 'Ilimitado' : item.limit}
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {item.percent === null ? 'Sem limite' : `${item.percent}% usado`}
            </p>
          </div>
        ))}
      </div>

      <PlanComparisonTable
        currentPlan={status.plan}
        onSelectPlan={setTargetPlan}
        loadingPlan={checkoutMutation.variables?.planTier}
      />

      <UpgradeModal
        open={Boolean(targetPlan)}
        targetPlan={targetPlan}
        isLoading={checkoutMutation.isPending}
        onClose={() => setTargetPlan(null)}
        onConfirm={handleCheckout}
      />
    </div>
  );
}
