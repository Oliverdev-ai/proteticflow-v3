import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Filter, Plus, Search, X } from 'lucide-react';
import { JOB_STATUS_LABELS, type JobStatus } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { cn } from '../../../lib/utils';
import { formatBRL } from '../../../lib/format';
import { DataTable, type ColumnDef } from '../../../components/shared/data-table';
import { PageTransition } from '../../../components/shared/page-transition';
import { H1, Subtitle } from '../../../components/shared/typography';

type TrabalhoRow = {
  id: number;
  code: string;
  status: JobStatus;
  totalCents: number;
  deadline: string | Date;
  patientName: string | null;
  prothesisType: string | null;
  clientName: string | null;
  clientId: number;
  jobSubType: 'standard' | 'proof' | 'rework';
  isUrgent: boolean;
  suspendedAt: string | Date | null;
};

const STATUS_OPTIONS: Array<{ value: JobStatus; label: string }> = Object.entries(JOB_STATUS_LABELS)
  .map(([value, label]) => ({ value: value as JobStatus, label }));

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {JOB_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PriorityBadge({ urgent }: { urgent: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide',
        urgent
          ? 'border-destructive/30 bg-destructive-soft text-destructive'
          : 'border-border bg-muted text-muted-foreground',
      )}
    >
      {urgent ? 'Urgente' : 'Normal'}
    </span>
  );
}

function DeadlineCell({ deadline, status }: { deadline: string | Date; status: JobStatus }) {
  const date = new Date(deadline);
  const isOverdue = date.getTime() < Date.now() && !['delivered', 'cancelled'].includes(status);

  return (
    <span className={cn('font-tabular text-sm', isOverdue ? 'text-destructive' : 'text-foreground')}>
      {date.toLocaleDateString('pt-BR')}
    </span>
  );
}

function buildExportUrl(params: {
  search: string;
  statuses: JobStatus[];
  clientId: string;
  deadlineFrom: string;
  deadlineTo: string;
}) {
  const query = new URLSearchParams();
  if (params.search.trim()) query.set('search', params.search.trim());
  if (params.statuses.length > 0) query.set('status', params.statuses.join(','));
  if (params.clientId) query.set('clientId', params.clientId);
  if (params.deadlineFrom) query.set('deadlineFrom', new Date(`${params.deadlineFrom}T00:00:00`).toISOString());
  if (params.deadlineTo) query.set('deadlineTo', new Date(`${params.deadlineTo}T23:59:59`).toISOString());
  const suffix = query.toString();
  return `/api/trabalhos/export.csv${suffix ? `?${suffix}` : ''}`;
}

export default function JobListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [deadlineFrom, setDeadlineFrom] = useState('');
  const [deadlineTo, setDeadlineTo] = useState('');
  const [statuses, setStatuses] = useState<JobStatus[]>([]);
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const clientsQuery = trpc.clientes.list.useQuery({ page: 1, limit: 100 });
  const jobsQuery = trpc.job.listPage.useQuery({
    page,
    pageSize,
    statuses: statuses.length > 0 ? statuses : undefined,
    clientId: clientId ? Number(clientId) : undefined,
    deadlineFrom: deadlineFrom ? new Date(`${deadlineFrom}T00:00:00`).toISOString() : undefined,
    deadlineTo: deadlineTo ? new Date(`${deadlineTo}T23:59:59`).toISOString() : undefined,
    search: search.trim() || undefined,
    orderBy: 'deadline',
    order: 'asc',
  });

  const rows = (jobsQuery.data?.items ?? []) as TrabalhoRow[];
  const total = jobsQuery.data?.total ?? 0;
  const hasFilters = Boolean(search || clientId || deadlineFrom || deadlineTo || statuses.length > 0);

  const columns = useMemo<Array<ColumnDef<TrabalhoRow>>>(() => [
    {
      header: 'ID',
      cell: (row) => (
        <Link to={`/trabalhos/${row.id}`} className="font-semibold text-primary">
          {row.code}
        </Link>
      ),
    },
    {
      header: 'Cliente',
      accessor: (row) => row.clientName ?? 'Cliente nao informado',
    },
    {
      header: 'Trabalho',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">
            {row.prothesisType ?? row.patientName ?? 'Trabalho sem titulo'}
          </span>
          {row.patientName ? (
            <span className="text-xs text-muted-foreground">{row.patientName}</span>
          ) : null}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Prazo',
      cell: (row) => <DeadlineCell deadline={row.deadline} status={row.status} />,
      numeric: true,
    },
    {
      header: 'Prioridade',
      cell: (row) => <PriorityBadge urgent={row.isUrgent} />,
      hideOnMobile: true,
    },
    {
      header: 'Valor',
      cell: (row) => formatBRL(row.totalCents),
      numeric: true,
      hideOnMobile: true,
    },
    {
      header: 'Ações',
      cell: (row) => (
        <button
          type="button"
          onClick={() => navigate(`/trabalhos/${row.id}`)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Abrir
        </button>
      ),
    },
  ], [navigate]);

  function toggleStatus(status: JobStatus) {
    setPage(1);
    setStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
  }

  function clearFilters() {
    setSearch('');
    setClientId('');
    setDeadlineFrom('');
    setDeadlineTo('');
    setStatuses([]);
    setPage(1);
  }

  return (
    <PageTransition className="mx-auto flex h-full max-w-7xl flex-col gap-6 overflow-auto p-4 pb-12 md:p-1">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <H1>Trabalhos</H1>
          <Subtitle>Lista paginada com filtros server-side e exportação segura.</Subtitle>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={buildExportUrl({ search, statuses, clientId, deadlineFrom, deadlineTo })}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Download size={15} /> CSV
          </a>
          <button
            type="button"
            onClick={() => navigate('/trabalhos/novo')}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:brightness-105"
          >
            <Plus size={15} /> Novo Trabalho
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por OS, paciente, cliente ou tipo..."
              className="input-field w-full pl-9"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <Filter size={15} /> Filtros
          </button>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X size={15} /> Limpar
            </button>
          ) : null}
        </div>

        {filtersOpen ? (
          <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-3">
            <select
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
                setPage(1);
              }}
              className="input-field"
            >
              <option value="">Todos os clientes</option>
              {(clientsQuery.data?.data ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={deadlineFrom}
              onChange={(event) => {
                setDeadlineFrom(event.target.value);
                setPage(1);
              }}
              className="input-field"
            />
            <input
              type="date"
              value={deadlineTo}
              onChange={(event) => {
                setDeadlineTo(event.target.value);
                setPage(1);
              }}
              className="input-field"
            />
            <div className="flex flex-wrap gap-2 md:col-span-3">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleStatus(option.value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    statuses.includes(option.value)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        loading={jobsQuery.isLoading}
        density={density}
        onDensityChange={setDensity}
        emptyMessage={hasFilters ? 'Nenhum resultado para esses filtros.' : 'Nenhum trabalho encontrado.'}
        emptyAction={
          hasFilters ? (
            <button type="button" onClick={clearFilters} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
              Limpar filtros
            </button>
          ) : (
            <button type="button" onClick={() => navigate('/trabalhos/novo')} className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
              Criar primeiro trabalho
            </button>
          )
        }
        pagination={{ page, pageSize, total, onChange: setPage }}
      />
    </PageTransition>
  );
}
