import { TrendingUp, AlertTriangle, DollarSign, Activity } from 'lucide-react';
import { KpiCard } from '../shared/kpi-card';
import type { FinancialKpis, SparklineData } from '@proteticflow/shared';

export function KpiFinancial({
  data,
  revenueSparkline,
}: {
  data: FinancialKpis | null;
  revenueSparkline?: SparklineData;
}) {
  if (!data) {
    return (
      <div className="col-span-full rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
        Dados financeiros disponíveis a partir do plano Starter.{' '}
        <a href="/planos" className="text-primary hover:underline">Fazer upgrade</a>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCard
        label="A Receber"
        value={data.pendingArCents}
        format="currency"
        icon={TrendingUp}
      />
      <KpiCard
        label="Vencidos"
        value={data.overdueArCents}
        format="currency"
        icon={AlertTriangle}
        trend={data.overdueArCents > 0 ? { value: 100, direction: 'down' } : { value: 0, direction: 'neutral' }}
      />
      <KpiCard
        label="Receita do Mês"
        value={data.monthRevenueCents}
        format="currency"
        icon={DollarSign}
        trend={revenueSparkline ? {
          value: revenueSparkline.changePercent,
          direction: revenueSparkline.trend,
        } : undefined}
      />
      <KpiCard
        label="Fluxo de Caixa"
        value={data.cashFlowCents}
        format="currency"
        icon={Activity}
        trend={{ value: 0, direction: data.cashFlowCents >= 0 ? 'neutral' : 'down' }}
      />
    </div>
  );
}
