import { Link } from 'react-router-dom';
import { JOB_STATUS_CHIP, type JobStatus, type RecentJob } from '@proteticflow/shared';
import { formatBRL } from '../../lib/format';
import { FadeIn } from '../shared/page-transition';
import { DataTable, type Column } from '../shared/data-table';
import { DeadlineCell } from '../shared/deadline-cell';
import { StatusChip } from '../shared/status-chip';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const JOB_STATUS_VALUES = new Set<JobStatus>([
  'pending',
  'in_progress',
  'quality_check',
  'ready',
  'rework_in_progress',
  'suspended',
  'delivered',
  'cancelled',
]);

function toJobStatus(status: string): JobStatus | null {
  return JOB_STATUS_VALUES.has(status as JobStatus) ? (status as JobStatus) : null;
}

export function RecentJobsTable({ jobs }: { jobs: RecentJob[] }) {
  const columns: Column<RecentJob>[] = [
    {
      id: 'code',
      header: 'Codigo',
      width: '120px',
      cell: (row) => (
        <Link
          to={`/trabalhos/${row.id}`}
          className="t-mono text-primary hover:text-primary/80 transition-colors"
        >
          {row.code}
        </Link>
      ),
    },
    {
      id: 'client',
      header: 'Cliente',
      width: 'flex',
      hideBelow: 'sm',
      cell: (row) => <span className="block truncate">{row.clientName}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: '136px',
      hideBelow: 'md',
      cell: (row) => {
        const status = toJobStatus(row.status);
        if (!status) {
          return <StatusChip label={row.status} variant="neutral" />;
        }

        const chip = JOB_STATUS_CHIP[status];
        return <StatusChip label={chip.label} variant={chip.variant} />;
      },
    },
    {
      id: 'deadline',
      header: 'Prazo',
      width: '112px',
      align: 'right',
      cell: (row) => {
        const status = toJobStatus(row.status);
        if (!row.dueDate || !status) {
          return <span className="t-small text-muted-foreground">{formatDate(row.dueDate)}</span>;
        }

        return <DeadlineCell deadline={new Date(row.dueDate)} status={status} />;
      },
    },
    {
      id: 'value',
      header: 'Valor',
      width: '112px',
      align: 'right',
      hideBelow: 'sm',
      cell: (row) => <span className="tabular-nums">{formatBRL(row.totalCents)}</span>,
    },
  ];

  return (
    <FadeIn className="premium-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">Trabalhos Recentes</h3>
        <Link to="/trabalhos" className="t-small text-primary hover:text-primary/80 transition-colors">
          Ver todos
        </Link>
      </div>
      <DataTable
        columns={columns}
        rows={jobs}
        getKey={(row) => row.id}
        density="compact"
        empty={{ title: 'Nenhum trabalho cadastrado' }}
        className="rounded-none border-0"
      />
    </FadeIn>
  );
}
