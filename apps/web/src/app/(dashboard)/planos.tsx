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
        label: 'Usuarios',
        current: status.usage.users.current,
        limit: status.usage.users.limit,
        percent: status.usage.users.usagePercent,
      },
      {
        label: 'Tabelas de precos',
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
        <p className="text-sm text-neutral-400">Carregando informacoes de assinatura...</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Planos e Licenciamento</h1>
        <p className="text-sm text-red-400">Nao foi possivel carregar os dados de licenca.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Planos e Licenciamento</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Plano atual: <span className="text-neutral-100 font-medium">{formatPlan(status.plan)}</span>
          </p>
          {status.plan === 'trial' ? (
            <p className="text-xs text-neutral-500 mt-1">
              Trial {status.trialExpired ? 'expirado' : 'ativo'}.
            </p>
          ) : null}
        </div>

        {status.plan !== 'trial' ? (
          <button
            type="button"
            onClick={handleOpenBillingPortal}
            disabled={isLoading}
            className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-60"
          >
            Gerenciar cobrança
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {usageCards.map((item) => (
          <div key={item.label} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <p className="text-xs uppercase tracking-wider text-neutral-500">{item.label}</p>
            <p className="mt-2 text-xl font-semibold text-white">
              {item.current}
              <span className="text-sm text-neutral-400">
                {' '}/ {item.limit === null ? 'Ilimitado' : item.limit}
              </span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">
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
