import { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { UpgradeModal } from './upgrade-modal';

function formatPlanName(plan: string) {
  if (plan === 'trial') return 'Trial';
  if (plan === 'starter') return 'Starter';
  if (plan === 'pro') return 'Pro';
  if (plan === 'enterprise') return 'Enterprise';
  return plan;
}

export function UsageBanner() {
  const [openUpgrade, setOpenUpgrade] = useState(false);
  const { data } = trpc.licensing.getUsage.useQuery();

  if (!data) return null;

  const fullAccessDaysLeft = data.trialDaysLeft ?? 0;
  const isTrialExpired = data.planStatus === 'expired';
  const isPromotional = data.fullAccessActive && fullAccessDaysLeft > 0;

  if (!isTrialExpired && !isPromotional) return null;

  return (
    <>
      <div className={`w-full px-4 py-2 text-center text-xs font-black uppercase tracking-widest ${
        isTrialExpired ? 'bg-red-500 text-white' : 'bg-amber-400 text-black'
      }`}>
        {isTrialExpired
          ? `Trial encerrado - modo demo com limites reduzidos (${data.managerActionsUsed}/${data.managerActionsLimit ?? 0} acoes mes)`
          : `Plano ${formatPlanName(data.plan)} com acesso completo por mais ${fullAccessDaysLeft} dia${fullAccessDaysLeft !== 1 ? 's' : ''}`}
        <button
          type="button"
          onClick={() => setOpenUpgrade(true)}
          className="ml-4 underline"
        >
          Ver planos
        </button>
      </div>

      <UpgradeModal open={openUpgrade} onClose={() => setOpenUpgrade(false)} />
    </>
  );
}
