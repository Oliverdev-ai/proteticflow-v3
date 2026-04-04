import { Users2, Coins, ClipboardList } from 'lucide-react';
import { KpiCard } from './kpi-card';
import type { EmployeeKpis } from '@proteticflow/shared';
import { formatBRL } from '../../lib/format';

export function KpiEmployees({ data }: { data: EmployeeKpis }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <KpiCard
        label="Funcionários Ativos"
        value={String(data.total)}
        icon={Users2}
        sub="Ativos no sistema"
        variant="default"
      />
      <KpiCard
        label="Comissões Pendentes"
        value={formatBRL(data.commissionPendingCents)}
        icon={Coins}
        sub="Aguardando pagamento"
        variant={data.commissionPendingCents > 0 ? 'warning' : 'default'}
      />
      <KpiCard
        label="Atribuições Ativas"
        value={String(data.pendingAssignments)}
        icon={ClipboardList}
        sub="Em trabalhos ativos"
        variant="default"
      />
    </div>
  );
}
