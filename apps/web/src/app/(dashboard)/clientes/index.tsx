import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { usePermissions } from '../../../hooks/use-permissions';
import { Button } from '../../../components/ui/button';
import { PageTitle } from '../../../components/shared/typography';
import { FilterBar } from '../../../components/shared/filter-bar';
import { DataTable, type Column } from '../../../components/shared/data-table';
import { StatusChip } from '../../../components/shared/status-chip';

const PAGE_SIZE = 20;
const PERSON_TYPE_LABEL: Record<'cpf' | 'cnpj', string> = {
  cpf: 'Pessoa fisica',
  cnpj: 'Pessoa juridica',
};
const STATUS_CHIP: Record<'active' | 'inactive', { label: string; variant: 'success' | 'neutral' }> = {
  active: { label: 'Ativo', variant: 'success' },
  inactive: { label: 'Inativo', variant: 'neutral' },
};

type ClientStatus = 'active' | 'inactive';
type ClientDocumentType = 'cpf' | 'cnpj' | null;

type ClientRow = {
  id: number;
  name: string;
  clinic: string | null;
  phone: string | null;
  document: string | null;
  documentType: ClientDocumentType;
  status: ClientStatus;
};

function toClientStatus(value: string): ClientStatus {
  return value === 'inactive' ? 'inactive' : 'active';
}

export default function ClientListPage() {
  const navigate = useNavigate();
  const { hasAccess } = usePermissions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ClientStatus | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = trpc.clientes.list.useQuery({
    search: search || undefined,
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const toggleMutation = trpc.clientes.toggleStatus.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = trpc.clientes.delete.useMutation({ onSuccess: () => refetch() });

  const canDelete = hasAccess('clients.delete');
  const total = Number(data?.total ?? 0);

  const rows: ClientRow[] = (data?.data ?? []).map((client) => ({
    id: client.id,
    name: client.name,
    clinic: client.clinic ?? null,
    phone: client.phone ?? null,
    document: client.document ?? null,
    documentType: client.documentType ?? null,
    status: toClientStatus(client.status),
  }));

  const columns: Column<ClientRow>[] = [
    {
      id: 'name',
      header: 'Nome',
      width: 'flex',
      cell: (row) => (
        <div className="min-w-0">
          <Link to={`/clientes/${row.id}`} className="block truncate text-[var(--primary)] hover:underline">
            {row.name}
          </Link>
          <div className="flex items-center gap-2">
            <span className="t-micro text-[var(--fg-muted)]">{row.document ?? 'Sem documento'}</span>
            {row.documentType ? (
              <span className="t-micro rounded-full border border-[var(--border)] px-2 py-[2px] text-[var(--fg-muted)]">
                {PERSON_TYPE_LABEL[row.documentType]}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: 'clinic',
      header: 'Clinica',
      width: '200px',
      hideBelow: 'md',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{row.clinic ?? 'Direto'}</span>,
    },
    {
      id: 'contact',
      header: 'Contato',
      width: '160px',
      hideBelow: 'sm',
      cell: (row) => <span className="t-small">{row.phone ?? 'N/A'}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: '120px',
      cell: (row) => {
        const chip = STATUS_CHIP[row.status];
        return <StatusChip label={chip.label} variant={chip.variant} />;
      },
    },
    {
      id: 'actions',
      header: 'Acoes',
      width: '138px',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              toggleMutation.mutate({ id: row.id });
            }}
            disabled={toggleMutation.isPending}
            className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] disabled:opacity-50"
            aria-label={row.status === 'active' ? 'Desativar cliente' : 'Ativar cliente'}
          >
            {row.status === 'active' ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
          </button>

          {canDelete ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (window.confirm('Excluir cliente permanentemente?')) {
                  deleteMutation.mutate({ id: row.id });
                }
              }}
              disabled={deleteMutation.isPending}
              className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--destructive)] disabled:opacity-50"
              aria-label="Excluir cliente"
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        subtitle="Gerencie dentistas, clinicas e laboratorios parceiros."
        actions={(
          <Button type="button" onClick={() => navigate('/clientes/novo')}>
            <Plus className="size-4" aria-hidden="true" />
            Novo parceiro
          </Button>
        )}
      >
        Parceiros
      </PageTitle>

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        filters={(
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ClientStatus | '');
              setPage(1);
            }}
            aria-label="Filtrar por status"
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
          >
            <option value="">Status: Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        )}
      />

      {error ? (
        <p className="t-small text-[var(--destructive)]">
          Erro ao carregar parceiros: {error.message}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.id}
        loading={isLoading}
        loadingRows={8}
        onRowClick={(row) => navigate(`/clientes/${row.id}`)}
        empty={{
          title: 'Nenhum parceiro encontrado',
          description: search || status ? 'Ajuste os filtros para continuar.' : 'Cadastre seu primeiro parceiro.',
          cta: (
            <Button type="button" size="sm" onClick={() => navigate('/clientes/novo')}>
              Novo parceiro
            </Button>
          ),
        }}
      />

      {total > PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="t-small text-[var(--fg-muted)]">
            Mostrando {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} de {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <span className="t-small rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5">
              Pagina {page}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={page * PAGE_SIZE >= total}
              onClick={() => setPage((prev) => prev + 1)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
