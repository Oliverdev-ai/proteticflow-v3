import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { JOB_STATUS_CHIP, type JobStatus } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { cn } from '../../../lib/utils';
import { formatBRL } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { PageTitle } from '../../../components/shared/typography';
import { FilterBar } from '../../../components/shared/filter-bar';
import { DeadlineCell } from '../../../components/shared/deadline-cell';
import { StatusChip } from '../../../components/shared/status-chip';
import { DataTable, type Column, type DataTableSort } from '../../../components/shared/data-table';

const STATUS_OPTIONS: JobStatus[] = ['pending', 'in_progress', 'quality_check', 'ready', 'rework_in_progress', 'suspended', 'delivered', 'cancelled'];
type JobSortId = 'code' | 'client' | 'value' | 'deadline';
type JobRow = { id: number; code: string; clientName: string | null; patientName: string | null; status: JobStatus; totalCents: number; deadline: Date };
function isJobSortId(value: string): value is JobSortId {
  return value === 'code' || value === 'client' || value === 'value' || value === 'deadline';
}

export default function JobListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [overdue, setOverdue] = useState(false);
  const [sort, setSort] = useState<{ id: JobSortId; dir: 'asc' | 'desc' }>({ id: 'deadline', dir: 'asc' });
  const [cursor, setCursor] = useState<number | undefined>();

  function handleSearchChange(value: string) { setSearch(value); setCursor(undefined); }
  function handleStatusChange(value: JobStatus | '') { setStatus(value); setCursor(undefined); }
  function handleOverdueToggle() { setOverdue((prev) => !prev); setCursor(undefined); }
  function handleSortChange(nextSort: DataTableSort) {
    if (!isJobSortId(nextSort.id)) return;
    setSort({ id: nextSort.id, dir: nextSort.dir });
    setCursor(undefined);
  }

  const { data, isLoading, error } = trpc.job.list.useQuery({
    search: search || undefined,
    status: status || undefined,
    overdue: overdue || undefined,
    sortBy: sort.id,
    sortDir: sort.dir,
    cursor,
    limit: 20,
  });

  const rows: JobRow[] = (data?.data ?? []).map((job) => ({
    id: job.id,
    code: job.code,
    clientName: job.clientName,
    patientName: job.patientName,
    status: job.status as JobStatus,
    totalCents: job.totalCents,
    deadline: new Date(job.deadline),
  }));

  const columns: Column<JobRow>[] = [
    { id: 'code', header: 'Codigo', width: '128px', sortable: true, cell: (row) => <span className="t-mono text-[var(--fg-strong)]">{row.code}</span> },
    { id: 'client', header: 'Cliente', width: 'flex', sortable: true, hideBelow: 'md', cell: (row) => <span className="block truncate">{row.clientName ?? '—'}</span> },
    { id: 'patient', header: 'Paciente', width: 'flex', hideBelow: 'sm', cell: (row) => <span className="text-muted-foreground">{row.patientName ?? '—'}</span> },
    {
      id: 'status',
      header: 'Status',
      width: '136px',
      cell: (row) => {
        const chip = JOB_STATUS_CHIP[row.status];
        return <StatusChip label={chip.label} variant={chip.variant} />;
      },
    },
    {
      id: 'value',
      header: 'Valor',
      width: '120px',
      sortable: true,
      hideBelow: 'md',
      align: 'right',
      cell: (row) => <span className="tabular-nums font-medium">{formatBRL(row.totalCents)}</span>,
    },
    { id: 'deadline', header: 'Prazo', width: '120px', sortable: true, align: 'right', cell: (row) => <DeadlineCell deadline={row.deadline} status={row.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        subtitle="Acompanhe as OS abertas e seu status."
        actions={
          <Button type="button" onClick={() => navigate('/trabalhos/novo')}>
            <Plus className="size-4" aria-hidden="true" />
            Nova OS
          </Button>
        }
      >
        Trabalhos
      </PageTitle>

      <FilterBar
        search={search}
        onSearchChange={handleSearchChange}
        filters={(
          <select
            value={status}
            onChange={(event) => handleStatusChange(event.target.value as JobStatus | '')}
            aria-label="Filtrar por status"
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          >
            <option value="">Status: Todos</option>
            {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{JOB_STATUS_CHIP[item].label}</option>)}
          </select>
        )}
        actions={(
          <button
            type="button"
            onClick={handleOverdueToggle}
            aria-pressed={overdue}
            className={cn(
              'h-9 rounded-[var(--radius-md)] border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
              overdue
                ? 'border-[var(--destructive)] bg-[var(--destructive)] text-white'
                : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] hover:bg-[var(--bg-muted)]',
            )}
          >
            Atrasados
          </button>
        )}
      />

      {error ? <p className="t-small text-destructive">{error.message}</p> : null}

      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.id}
        onRowClick={(row) => navigate(`/trabalhos/${row.id}`)}
        sort={sort}
        onSortChange={handleSortChange}
        loading={isLoading}
        loadingRows={6}
        empty={{
          title: 'Nenhuma OS encontrada',
          description: 'Ajuste os filtros ou cadastre uma nova ordem de servico.',
          cta: <Button type="button" size="sm" onClick={() => navigate('/trabalhos/novo')}>Nova OS</Button>,
        }}
      />

      {data?.nextCursor ? (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={() => setCursor(data.nextCursor)}>Carregar mais</Button>
        </div>
      ) : null}
    </div>
  );
}
