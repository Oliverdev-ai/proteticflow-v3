import { useMemo, useState } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { formatBRL } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { PageTitle } from '../../../components/shared/typography';
import { FilterBar } from '../../../components/shared/filter-bar';
import { DataTable, type Column } from '../../../components/shared/data-table';
import { StatusChip } from '../../../components/shared/status-chip';

type PayrollStatus = 'open' | 'closed';

type PayrollPeriodRow = {
  id: number;
  year: number;
  month: number;
  status: PayrollStatus;
  totalGrossCents: number;
  totalNetCents: number;
  closedAt: string | null;
};

function toPayrollStatus(value: string): PayrollStatus {
  return value === 'closed' ? 'closed' : 'open';
}

function getMonthName(month: number) {
  return new Date(2000, month - 1, 1).toLocaleString('pt-BR', { month: 'long' });
}

export default function PayrollIndex() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PayrollStatus | ''>('');
  const [isCreating, setIsCreating] = useState(false);
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState(new Date().getFullYear());

  const { data: periods, isLoading, error } = trpc.payroll.listPeriods.useQuery();

  const createMutation = trpc.payroll.createPeriod.useMutation({
    onSuccess: async (period) => {
      if (!period) return;
      await utils.payroll.listPeriods.invalidate();
      setIsCreating(false);
      navigate(`/payroll/${period.id}`);
    },
  });

  const rows: PayrollPeriodRow[] = useMemo(
    () =>
      (periods ?? []).map((period) => ({
        id: period.id,
        year: period.year,
        month: period.month,
        status: toPayrollStatus(period.status),
        totalGrossCents: period.totalGrossCents ?? 0,
        totalNetCents: period.totalNetCents ?? 0,
        closedAt: period.closedAt ? period.closedAt.toString() : null,
      })),
    [periods],
  );

  const normalizedSearch = search.trim().toLowerCase();
  const visibleRows = rows.filter((row) => {
    const periodLabel = `${getMonthName(row.month)} ${row.year}`.toLowerCase();
    const matchesSearch = !normalizedSearch || periodLabel.includes(normalizedSearch);
    const matchesStatus = !statusFilter || row.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<PayrollPeriodRow>[] = [
    {
      id: 'period',
      header: 'Periodo',
      width: 'flex',
      cell: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium capitalize">{getMonthName(row.month)}</span>
          <span className="t-small text-[var(--fg-muted)]">{row.year}</span>
        </div>
      ),
    },
    {
      id: 'gross',
      header: 'Total bruto',
      width: '140px',
      align: 'right',
      hideBelow: 'sm',
      cell: (row) => <span className="tabular-nums">{formatBRL(row.totalGrossCents)}</span>,
    },
    {
      id: 'net',
      header: 'Total liquido',
      width: '140px',
      align: 'right',
      cell: (row) => <span className="tabular-nums font-medium">{formatBRL(row.totalNetCents)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: '120px',
      cell: (row) => (
        <StatusChip
          label={row.status === 'closed' ? 'Fechado' : 'Aberto'}
          variant={row.status === 'closed' ? 'success' : 'warning'}
        />
      ),
    },
    {
      id: 'closedAt',
      header: 'Fechamento',
      width: '130px',
      hideBelow: 'md',
      cell: (row) => (
        <span className="t-small text-[var(--fg-muted)]">
          {row.closedAt ? new Date(row.closedAt).toLocaleDateString('pt-BR') : '-'}
        </span>
      ),
    },
  ];

  const handleCreate = () => {
    createMutation.mutate({ month: newMonth, year: newYear });
  };

  return (
    <div className="space-y-4">
      <PageTitle
        subtitle="Gerencie periodos de folha, totais e fechamento mensal."
        actions={(
          <Button type="button" onClick={() => setIsCreating((prev) => !prev)}>
            <Plus className="size-4" aria-hidden="true" />
            {isCreating ? 'Fechar formulario' : 'Novo periodo'}
          </Button>
        )}
      >
        Folha de pagamento
      </PageTitle>

      {isCreating ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="t-small text-[var(--fg-muted)]">Mes</span>
              <select
                value={newMonth}
                onChange={(event) => setNewMonth(Number(event.target.value))}
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                  <option key={month} value={month}>
                    {getMonthName(month)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="t-small text-[var(--fg-muted)]">Ano</span>
              <input
                type="number"
                value={newYear}
                onChange={(event) => setNewYear(Number(event.target.value))}
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              />
            </label>
          </div>

          {createMutation.error ? <p className="mt-3 t-small text-[var(--destructive)]">{createMutation.error.message}</p> : null}

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsCreating(false)}>
              Cancelar
            </Button>
            <Button type="button" loading={createMutation.isPending} onClick={handleCreate}>
              Abrir periodo
            </Button>
          </div>
        </div>
      ) : null}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={(
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as PayrollStatus | '')}
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            aria-label="Filtrar periodos por status"
          >
            <option value="">Status: Todos</option>
            <option value="open">Abertos</option>
            <option value="closed">Fechados</option>
          </select>
        )}
      />

      {error ? <p className="t-small text-[var(--destructive)]">Erro ao carregar periodos: {error.message}</p> : null}

      <DataTable
        columns={columns}
        rows={visibleRows}
        getKey={(row) => row.id}
        onRowClick={(row) => navigate(`/payroll/${row.id}`)}
        loading={isLoading}
        loadingRows={8}
        empty={{
          title: 'Nenhum periodo encontrado',
          description: search || statusFilter ? 'Ajuste os filtros para continuar.' : 'Abra o primeiro periodo de folha.',
          cta: (
            <Button type="button" size="sm" onClick={() => setIsCreating(true)}>
              Abrir periodo
            </Button>
          ),
        }}
      />

      <div className="t-small flex items-center gap-2 text-[var(--fg-muted)]">
        <Calendar className="size-4" aria-hidden="true" />
        Total de periodos: {rows.length}
      </div>
    </div>
  );
}
