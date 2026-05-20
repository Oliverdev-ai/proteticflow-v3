import { Users2, Coins, ClipboardList } from 'lucide-react';
import { KpiCard } from '../shared/kpi-card';
import type { EmployeeKpis } from '@proteticflow/shared';

export function KpiEmployees({ data }: { data: EmployeeKpis }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <KpiCard
        label="Funcionários Ativos"
        value={data.total}
        icon={Users2}
      />
      <KpiCard
        label="Comissões Pendentes"
        value={data.commissionPendingCents}
        format="currency"
        icon={Coins}
      />
      <KpiCard
        label="Atribuições Ativas"
        value={data.pendingAssignments}
        icon={ClipboardList}
      />
    </div>
  );
}
