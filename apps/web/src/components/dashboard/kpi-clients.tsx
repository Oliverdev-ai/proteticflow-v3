import { Users, UserCheck, UserPlus } from 'lucide-react';
import { KpiCard } from '../shared/kpi-card';
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
        value={data.total}
        icon={Users}
      />
      <KpiCard
        label="Clientes Ativos"
        value={data.active}
        icon={UserCheck}
      />
      <KpiCard
        label="Novos este Mês"
        value={data.newThisMonth}
        icon={UserPlus}
        trend={newClientsSparkline ? {
          value: newClientsSparkline.changePercent,
          direction: newClientsSparkline.trend,
          format: 'percent',
        } : undefined}
      />
    </div>
  );
}
