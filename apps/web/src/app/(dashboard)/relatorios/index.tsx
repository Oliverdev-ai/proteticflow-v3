import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Download,
  Package,
  Receipt,
  TrendingDown,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import { formatBRL } from '../../../lib/format';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle } from '../../../components/shared/typography';
import { KpiCard } from '../../../components/shared/kpi-card';
import { DataTable, type ColumnDef } from '../../../components/shared/data-table';
import { JobsBarChart, RevenueLineChart } from '../../../components/charts';
import { cn } from '../../../lib/utils';

type ReportTab = 'production' | 'financial' | 'clients' | 'inventory';

type ClientRankingRow = {
  clientId: number;
  clientName: string;
  clinic: string | null;
  status: 'active' | 'inactive';
  totalJobs: number;
  totalRevenueCents: number;
  paidCents: number;
  pendingCents: number;
  periodTotalCents: number;
  onTimePercent: number;
};

type TopClientRow = {
  clientId: number;
  clientName: string;
  totalPaidCents: number;
  count: number;
};

type InventoryStatus = 'critical' | 'low' | 'ok';

type InventoryRow = {
  materialId: number;
  materialName: string;
  code: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number | null;
  averageCostCents: number;
  status: InventoryStatus;
  isActive: boolean;
};

const REPORT_TABS: Array<{ id: ReportTab; label: string; icon: LucideIcon }> = [
  { id: 'production', label: 'Produção', icon: BarChart3 },
  { id: 'financial', label: 'Financeiro', icon: Receipt },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'inventory', label: 'Estoque', icon: Package },
];

const TAB_SET = new Set<ReportTab>(REPORT_TABS.map((tab) => tab.id));

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toIsoRange(value: string, mode: 'start' | 'end') {
  return new Date(`${value}T${mode === 'start' ? '00:00:00' : '23:59:59'}`).toISOString();
}

function getInitialRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: toInputDate(start),
    dateTo: toInputDate(now),
  };
}

function shortMonth(value: string) {
  const [year = '2026', month = '1'] = value.split('-');
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(
    new Date(Number(year), Number(month) - 1, 1),
  );
}

function ExportButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-foreground hover:bg-muted/40"
    >
      <Download size={15} aria-hidden="true" />
      CSV
    </a>
  );
}

function StatusBadge({ status }: { status: InventoryStatus }) {
  const label = status === 'critical' ? 'CRÍTICO' : status === 'low' ? 'ABAIXO' : 'OK';
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
        status === 'critical' && 'border-destructive/30 bg-destructive/10 text-destructive',
        status === 'low' && 'border-warning/30 bg-warning/10 text-warning',
        status === 'ok' && 'border-success/30 bg-success/10 text-success',
      )}
    >
      {label}
    </span>
  );
}

export default function ReportsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = useMemo(getInitialRange, []);
  const [dateFrom, setDateFrom] = useState(range.dateFrom);
  const [dateTo, setDateTo] = useState(range.dateTo);
  const [clientPage, setClientPage] = useState(1);

  const tabParam = searchParams.get('tab');
  const activeTab: ReportTab = TAB_SET.has(tabParam as ReportTab) ? (tabParam as ReportTab) : 'production';

  const filters = useMemo(
    () => ({
      dateFrom: toIsoRange(dateFrom, 'start'),
      dateTo: toIsoRange(dateTo, 'end'),
    }),
    [dateFrom, dateTo],
  );

  const exportHref = `/api/reports/export.csv?type=${activeTab}&dateFrom=${encodeURIComponent(filters.dateFrom)}&dateTo=${encodeURIComponent(filters.dateTo)}`;

  const productionQuery = trpc.reports.productionDashboard.useQuery(filters);
  const financialQuery = trpc.reports.financialDashboard.useQuery(filters);
  const clientRankingQuery = trpc.reports.clientRanking.useQuery({
    ...filters,
    page: clientPage,
    pageSize: 10,
  });
  const inventoryQuery = trpc.reports.inventoryDashboard.useQuery(filters);

  const topClientColumns: ColumnDef<TopClientRow>[] = [
    { header: 'Cliente', accessor: 'clientName' },
    { header: 'Títulos', accessor: 'count', numeric: true },
    {
      header: 'Recebido',
      numeric: true,
      cell: (row) => formatBRL(row.totalPaidCents),
    },
  ];

  const clientColumns: ColumnDef<ClientRankingRow>[] = [
    { header: 'Cliente', accessor: 'clientName' },
    { header: 'Clínica', accessor: (row) => row.clinic ?? '-', hideOnMobile: true },
    { header: 'Jobs', accessor: 'totalJobs', numeric: true },
    {
      header: 'Receita',
      numeric: true,
      cell: (row) => formatBRL(row.periodTotalCents),
    },
    {
      header: 'Recebido',
      numeric: true,
      cell: (row) => formatBRL(row.paidCents),
    },
    {
      header: 'Pendente',
      numeric: true,
      cell: (row) => formatBRL(row.pendingCents),
      hideOnMobile: true,
    },
    {
      header: 'Pontualidade',
      numeric: true,
      cell: (row) => `${row.onTimePercent}%`,
      hideOnMobile: true,
    },
  ];

  const inventoryColumns: ColumnDef<InventoryRow>[] = [
    { header: 'Material', accessor: 'materialName' },
    { header: 'Código', accessor: (row) => row.code ?? '-', hideOnMobile: true },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    { header: 'Atual', accessor: 'currentStock', numeric: true },
    { header: 'Mínimo', accessor: 'minStock', numeric: true },
    {
      header: 'Máximo',
      numeric: true,
      cell: (row) => row.maxStock ?? '-',
      hideOnMobile: true,
    },
    { header: 'Un.', accessor: 'unit', hideOnMobile: true },
  ];

  return (
    <PageTransition className="mx-auto flex h-full max-w-7xl flex-col gap-6 overflow-auto p-4 pb-16 md:p-1">
      <ScaleIn className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <H1>Relatórios</H1>
          <Subtitle>Produção, financeiro, clientes e estoque com dados reais do tenant.</Subtitle>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setClientPage(1);
              setDateFrom(event.target.value);
            }}
            className="input-field h-10 w-[150px]"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setClientPage(1);
              setDateTo(event.target.value);
            }}
            className="input-field h-10 w-[150px]"
          />
          <ExportButton href={exportHref} />
        </div>
      </ScaleIn>

      <div className="flex flex-wrap gap-2 border-b border-border">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSearchParams({ tab: tab.id })}
              className={cn(
                'inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors',
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon size={16} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'production' && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Trabalhos" value={productionQuery.data?.summary.totalJobs ?? 0} loading={productionQuery.isLoading} icon={BarChart3} />
            <KpiCard label="Entregues" value={productionQuery.data?.summary.deliveredJobs ?? 0} loading={productionQuery.isLoading} icon={Package} />
            <KpiCard label="Atrasados" value={productionQuery.data?.summary.overdueJobs ?? 0} loading={productionQuery.isLoading} icon={TrendingDown} />
            <KpiCard label="Valor em OS" value={productionQuery.data?.summary.totalRevenueCents ?? 0} format="currency" loading={productionQuery.isLoading} icon={Receipt} />
          </div>
          <JobsBarChart
            title="Trabalhos por status"
            data={productionQuery.data?.statusBuckets ?? []}
            loading={productionQuery.isLoading}
          />
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Receitas" value={financialQuery.data?.summary.totalCreditsCents ?? 0} format="currency" loading={financialQuery.isLoading} icon={Receipt} />
            <KpiCard label="Despesas" value={financialQuery.data?.summary.totalDebitsCents ?? 0} format="currency" loading={financialQuery.isLoading} icon={TrendingDown} />
            <KpiCard label="Resultado" value={financialQuery.data?.summary.netCents ?? 0} format="currency" loading={financialQuery.isLoading} icon={BarChart3} />
            <KpiCard label="A receber" value={financialQuery.data?.summary.pendingCreditsCents ?? 0} format="currency" loading={financialQuery.isLoading} icon={Users} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <RevenueLineChart
              title="Fluxo de caixa"
              data={(financialQuery.data?.cashFlow ?? []).map((row) => ({
                label: shortMonth(row.label),
                value: row.value,
                comparison: row.comparison,
              }))}
              loading={financialQuery.isLoading}
              valueFormatter={(value) => formatBRL(Number(value))}
            />
            <DataTable
              columns={topClientColumns}
              data={financialQuery.data?.topClients ?? []}
              rowKey={(row) => row.clientId}
              loading={financialQuery.isLoading}
              emptyMessage="Sem recebimentos pagos no período."
              emptyAction={<ExportButton href={exportHref} />}
              density="compact"
            />
          </div>
        </div>
      )}

      {activeTab === 'clients' && (
        <DataTable
          columns={clientColumns}
          data={clientRankingQuery.data?.data ?? []}
          rowKey={(row) => row.clientId}
          loading={clientRankingQuery.isLoading}
          emptyMessage="Nenhum cliente com movimentação no período."
          emptyAction={<ExportButton href={exportHref} />}
          density="comfortable"
          pagination={{
            page: clientRankingQuery.data?.page ?? clientPage,
            pageSize: clientRankingQuery.data?.pageSize ?? 10,
            total: clientRankingQuery.data?.total ?? 0,
            onChange: setClientPage,
          }}
        />
      )}

      {activeTab === 'inventory' && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Materiais" value={inventoryQuery.data?.summary.totalMaterials ?? 0} loading={inventoryQuery.isLoading} icon={Package} />
            <KpiCard label="Crítico" value={inventoryQuery.data?.summary.criticalCount ?? 0} loading={inventoryQuery.isLoading} icon={TrendingDown} />
            <KpiCard label="Abaixo" value={inventoryQuery.data?.summary.lowCount ?? 0} loading={inventoryQuery.isLoading} icon={Receipt} />
            <KpiCard label="OK" value={inventoryQuery.data?.summary.okCount ?? 0} loading={inventoryQuery.isLoading} icon={BarChart3} />
          </div>
          <DataTable
            columns={inventoryColumns}
            data={inventoryQuery.data?.materials ?? []}
            rowKey={(row) => row.materialId}
            loading={inventoryQuery.isLoading}
            emptyMessage="Nenhum material cadastrado."
            emptyAction={<ExportButton href={exportHref} />}
            density="compact"
          />
        </div>
      )}
    </PageTransition>
  );
}
