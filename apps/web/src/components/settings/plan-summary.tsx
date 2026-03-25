import { useSettings } from '../../hooks/use-settings';

export function PlanSummary() {
  const { overview } = useSettings();
  const plan = overview.data?.plan;

  if (!plan) return <p className="text-sm text-neutral-400">Sem dados de plano.</p>;

  return (
    <div className="space-y-2 text-sm">
      <p className="text-white"><strong>Plano:</strong> {plan.current}</p>
      <p className="text-neutral-300"><strong>Expiracao:</strong> {plan.planExpiresAt ?? 'sem expiracao'}</p>
      <p className="text-neutral-300"><strong>Clientes:</strong> {plan.clientCount}</p>
      <p className="text-neutral-300"><strong>OS no mes:</strong> {plan.jobCountThisMonth}</p>
      <p className="text-neutral-300"><strong>Usuarios:</strong> {plan.userCount}</p>
      <p className="text-neutral-300"><strong>Tabelas de preco:</strong> {plan.priceTableCount}</p>
      <p className="text-neutral-300"><strong>Storage (MB):</strong> {plan.storageUsedMb}</p>
    </div>
  );
}
