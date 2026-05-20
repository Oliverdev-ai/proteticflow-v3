import { Wrench, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { KpiCard } from '../shared/kpi-card';
import type { JobKpis, SparklineData } from '@proteticflow/shared';

export function KpiJobs({
  data,
  activeSparkline,
}: {
  data: JobKpis;
  activeSparkline?: SparklineData;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <KpiCard
        label="Trabalhos Ativos"
        value={data.active}
        icon={Wrench}
        trend={activeSparkline ? {
          value: activeSparkline.changePercent,
          direction: activeSparkline.trend,
          format: 'percent',
        } : undefined}
      />
      <KpiCard
        label="Atrasados"
        value={data.overdue}
        icon={AlertCircle}
        trend={data.overdue > 0 ? { direction: 'down' } : undefined}
      />
      <KpiCard
        label="Pendentes"
        value={data.pending}
        icon={Clock}
      />
      <KpiCard
        label="Concluídos"
        value={data.completed}
        icon={CheckCircle}
      />
    </div>
  );
}
