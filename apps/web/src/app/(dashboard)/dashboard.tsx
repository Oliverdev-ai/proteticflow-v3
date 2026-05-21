import { RefreshCw } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { formatBRL } from '../../lib/format';
import { KpiFinancial } from '../../components/dashboard/kpi-financial';
import { KpiJobs } from '../../components/dashboard/kpi-jobs';
import { KpiClients } from '../../components/dashboard/kpi-clients';
import { KpiInventory } from '../../components/dashboard/kpi-inventory';
import { KpiEmployees } from '../../components/dashboard/kpi-employees';
import { ServiceDistributionChart } from '../../components/dashboard/service-distribution-chart';
import { TodayDeliveriesCard } from '../../components/dashboard/today-deliveries';
import { RecentJobsTable } from '../../components/dashboard/recent-jobs-table';
import { PredictionCard } from '../../components/dashboard/prediction-card';
import { KpiCard } from '../../components/shared/kpi-card';
import { PageTitle } from '../../components/shared/typography';
import { ChartSkeleton, JobsBarChart, RevenueLineChart } from '../../components/charts';
import { usePredictions } from '../../hooks/use-predictions';

const MONTH_ABBR: Record<string, string> = {
  '01': 'Jan',
  '02': 'Fev',
  '03': 'Mar',
  '04': 'Abr',
  '05': 'Mai',
  '06': 'Jun',
  '07': 'Jul',
  '08': 'Ago',
  '09': 'Set',
  '10': 'Out',
  '11': 'Nov',
  '12': 'Dez',
};

function formatPeriod(period: string) {
  const [, month] = period.split('-');
  return MONTH_ABBR[month ?? ''] ?? period;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBox({ className }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded-2xl ${className ?? ''}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <SkeletonBox className="h-8 w-40" />
        <SkeletonBox className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCard key={i} label="Carregando" value={0} loading />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCard key={i} label="Carregando" value={0} loading />
          ))}
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <KpiCard key={i} label="Carregando" value={0} loading />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <KpiCard key={i} label="Carregando" value={0} loading />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="Carregando" value={0} loading />
        <KpiCard label="Carregando" value={0} loading />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartSkeleton />
        <SkeletonBox className="h-64" />
        <ChartSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonBox className="lg:col-span-2 h-56" />
        <SkeletonBox className="h-56" />
      </div>
      <SkeletonBox className="h-64" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data, isLoading, refetch, isFetching } = trpc.dashboard.getSummary.useQuery(
    undefined,
    { refetchInterval: 5 * 60 * 1000 }, // 19.10 — polling 5 min
  );
  const predictions = usePredictions(20);

  if (isLoading) return <DashboardSkeleton />;

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground text-sm">Não foi possível carregar o dashboard.</p>
      </div>
    );
  }

  const revenueData = data.charts.monthlyRevenue.map((item) => ({
    label: formatPeriod(item.period),
    value: item.totalAmountCents / 100,
  }));

  const jobsTrendData = data.charts.jobsTrend.map((item) => ({
    label: formatPeriod(item.period),
    created: item.created,
    delivered: item.delivered,
  }));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <PageTitle>Dashboard</PageTitle>
          <p className="text-muted-foreground text-sm mt-0.5">Visão geral do laboratório</p>
        </div>
        <button
          onClick={async () => {
            await Promise.all([refetch(), predictions.refetch()]);
          }}
          disabled={isFetching || predictions.isFetching}
          className="flex items-center gap-2 px-3 py-2 text-sm text-foreground bg-card hover:bg-muted border border-border rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={isFetching || predictions.isFetching ? 'animate-spin' : ''}
          />
          Atualizar
        </button>
      </div>

      {/* 19.01 — KPIs financeiros */}
      <KpiFinancial data={data.financial} revenueSparkline={data.sparklines.revenue} />

      {/* 19.02–19.05 — Trabalhos + Clientes + Funcionários */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KpiJobs data={data.jobs} activeSparkline={data.sparklines.activeJobs} />
        <div className="space-y-4">
          <KpiClients data={data.clients} newClientsSparkline={data.sparklines.newClients} />
          <KpiEmployees data={data.employees} />
        </div>
      </div>

      {/* 19.04 — Estoque */}
      <KpiInventory data={data.inventory} />

      {/* 19.08 — Gráficos (BarChart, PieChart, LineChart) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RevenueLineChart
          title="Receita Mensal"
          data={revenueData}
          valueFormatter={(value) => formatBRL(Number(value) * 100)}
        />
        <ServiceDistributionChart data={data.charts.serviceDistribution} />
        <JobsBarChart
          title="Tendência de Trabalhos"
          data={jobsTrendData}
          bars={[
            { dataKey: 'created', label: 'Criados', variant: 'primary' },
            { dataKey: 'delivered', label: 'Entregues', variant: 'accent' },
          ]}
        />
      </div>

      {/* DASHBOARD PREDITIVO (FASE 32) */}
      <div className="pt-4 pb-2 border-t border-border mt-8 mb-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground mb-4">
          Análises Preditivas IA
        </h2>
        {predictions.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBox key={`prediction-skeleton-${index}`} className="h-[218px]" />
            ))}
          </div>
        ) : predictions.error ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Não foi possível carregar as análises preditivas agora.
          </div>
        ) : predictions.cards.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            Ainda não há previsões disponíveis para este tenant.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {predictions.cards.map((card) => (
              <PredictionCard
                key={card.id}
                title={card.title}
                prediction={card.prediction}
                confidence={card.confidence}
                type={card.type}
              />
            ))}
          </div>
        )}
      </div>

      {/* 19.07 + últimos trabalhos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecentJobsTable jobs={data.recentJobs} />
        </div>
        <TodayDeliveriesCard data={data.todayDeliveries} />
      </div>
    </div>
  );
}
