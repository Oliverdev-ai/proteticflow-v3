import { Users, UserCheck, UserPlus } from 'lucide-react';
import { KpiCard } from './kpi-card';
import type { ClientKpis, SparklineData } from '@proteticflow/shared';

export function KpiClients({
  data,
  newClientsSparkline,
}: {
  data: ClientKpis;
  newClientsSparkline?: SparklineData;
}) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <KpiCard
        label="Total de Clientes"
        value={String(data.total)}
        icon={Users}
        sub="Cadastrados"
        variant="default"
      />
      <KpiCard
        label="Clientes Ativos"
        value={String(data.active)}
        icon={UserCheck}
        sub="Status ativo"
        variant="success"
      />
      <KpiCard
        label="Novos este Mês"
        value={String(data.newThisMonth)}
        icon={UserPlus}
        sub="Cadastrados no mês"
        variant="success"
        sparkline={newClientsSparkline}
      />
    </div>
  );
}
