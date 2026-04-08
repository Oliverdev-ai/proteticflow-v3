import { Wrench, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { KpiCard } from './kpi-card';
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
        value={String(data.active)}
        icon={Wrench}
        sub="Em andamento"
        variant="default"
        sparkline={activeSparkline}
      />
      <KpiCard
        label="Atrasados"
        value={String(data.overdue)}
        icon={AlertCircle}
        sub="Fora do prazo"
        variant={data.overdue > 0 ? 'danger' : 'default'}
      />
      <KpiCard
        label="Pendentes"
        value={String(data.pending)}
        icon={Clock}
        sub="Aguardando início"
        variant="warning"
      />
      <KpiCard
        label="Concluídos"
        value={String(data.completed)}
        icon={CheckCircle}
        sub="Prontos ou entregues"
        variant="success"
      />
    </div>
  );
}
