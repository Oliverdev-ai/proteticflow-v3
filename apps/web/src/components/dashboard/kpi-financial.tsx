import { TrendingUp, AlertTriangle, DollarSign, Activity } from 'lucide-react';
import { KpiCard } from './kpi-card';
import type { FinancialKpis, SparklineData } from '@proteticflow/shared';
import { formatBRL } from '../../lib/format';

export function KpiFinancial({
  data,
  revenueSparkline,
}: {
  data: FinancialKpis;
  revenueSparkline?: SparklineData;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label="A Receber"
        value={formatBRL(data.pendingArCents)}
        icon={TrendingUp}
        sub="Pendente de recebimento"
        variant="success"
      />
      <KpiCard
        label="Vencidos"
        value={formatBRL(data.overdueArCents)}
        icon={AlertTriangle}
        sub="Contas em atraso"
        variant={data.overdueArCents > 0 ? 'danger' : 'default'}
      />
      <KpiCard
        label="Receita do Mês"
        value={formatBRL(data.monthRevenueCents)}
        icon={DollarSign}
        sub="Recebido este mês"
        variant="success"
        sparkline={revenueSparkline}
      />
      <KpiCard
        label="Fluxo de Caixa"
        value={formatBRL(data.cashFlowCents)}
        icon={Activity}
        sub="Entradas − Saídas"
        variant={data.cashFlowCents >= 0 ? 'default' : 'warning'}
      />
    </div>
  );
}
