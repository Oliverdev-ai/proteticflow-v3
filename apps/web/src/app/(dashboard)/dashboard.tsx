import { RefreshCw } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { KpiFinancial } from '../../components/dashboard/kpi-financial';
import { KpiJobs } from '../../components/dashboard/kpi-jobs';
import { KpiClients } from '../../components/dashboard/kpi-clients';
import { KpiInventory } from '../../components/dashboard/kpi-inventory';
import { KpiEmployees } from '../../components/dashboard/kpi-employees';
import { RevenueChart } from '../../components/dashboard/revenue-chart';
import { ServiceDistributionChart } from '../../components/dashboard/service-distribution-chart';
import { JobsTrendChart } from '../../components/dashboard/jobs-trend-chart';
import { TodayDeliveriesCard } from '../../components/dashboard/today-deliveries';
import { RecentJobsTable } from '../../components/dashboard/recent-jobs-table';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBox({ className }: { className?: string }) {
  return <div className={`bg-neutral-800 animate-pulse rounded-xl ${className ?? ''}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <SkeletonBox className="h-8 w-40" />
        <SkeletonBox className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonBox key={i} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonBox key={i} className="h-24" />)}
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonBox key={i} className="h-24" />)}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonBox key={i} className="h-24" />)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonBox className="h-64" />
        <SkeletonBox className="h-64" />
        <SkeletonBox className="h-64" />
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

  if (isLoading) return <DashboardSkeleton />;

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-neutral-400 text-sm">Não foi possível carregar o dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-neutral-400 text-sm mt-0.5">Visão geral do laboratório</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
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
        <RevenueChart data={data.charts.monthlyRevenue} />
        <ServiceDistributionChart data={data.charts.serviceDistribution} />
        <JobsTrendChart data={data.charts.jobsTrend} />
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
