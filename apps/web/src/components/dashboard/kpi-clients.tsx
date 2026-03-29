import { Users, UserPlus } from 'lucide-react';
import { KpiCard } from './kpi-card';
import type { ClientKpis } from '@proteticflow/shared';

export function KpiClients({ data }: { data: ClientKpis }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <KpiCard
        label="Total de Clientes"
        value={String(data.total)}
        icon={Users}
        sub="Clientes ativos"
        variant="default"
      />
      <KpiCard
        label="Novos este Mês"
        value={String(data.newThisMonth)}
        icon={UserPlus}
        sub="Cadastrados no mês"
        variant="success"
      />
    </div>
  );
}
