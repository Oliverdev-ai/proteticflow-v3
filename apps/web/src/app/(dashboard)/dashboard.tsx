import { RefreshCw } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { KpiFinancial } from '../../components/dashboard/kpi-financial';
import { KpiJobs } from '../../components/dashboard/kpi-jobs';
import { KpiClients } from '../../components/dashboard/kpi-clients';
import { KpiInventory } from '../../components/dashboard/kpi-inventory';
import { RevenueChart } from '../../components/dashboard/revenue-chart';
import { TodayDeliveriesCard } from '../../components/dashboard/today-deliveries';
import { RecentJobsTable } from '../../components/dashboard/recent-jobs-table';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBox({ className }: { className?: string }) {
  return (
    <div className={`bg-neutral-800 animate-pulse rounded-xl ${className ?? ''}`} />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <SkeletonBox className="h-8 w-40" />
        <SkeletonBox className="h-9 w-28" />
      </div>
      {/* Financial KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBox key={i} className="h-24" />
        ))}
      </div>
      {/* Jobs + Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBox key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonBox key={i} className="h-24" />
          ))}
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonBox key={i} className="h-24" />
          ))}
        </div>
      </div>
      {/* Chart + Deliveries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonBox className="lg:col-span-2 h-64" />
        <SkeletonBox className="h-64" />
      </div>
      {/* Recent jobs */}
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
      <KpiFinancial data={data.financial} />

      {/* 19.02–19.04 — Trabalhos + Clientes + Estoque */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KpiJobs data={data.jobs} />
        <div className="space-y-4">
          <KpiClients data={data.clients} />
          <KpiInventory data={data.inventory} />
        </div>
      </div>

      {/* 19.07–19.08 — Gráfico + Entregas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart data={data.charts.monthlyRevenue} />
        </div>
        <TodayDeliveriesCard data={data.todayDeliveries} />
      </div>

      {/* 19.06 — Trabalhos recentes */}
      <RecentJobsTable jobs={data.recentJobs} />
    </div>
  );
}
