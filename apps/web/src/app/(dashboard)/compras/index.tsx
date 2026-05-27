import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PURCHASE_ORDER_STATUS_CHIP } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { formatBRL } from '../../../lib/format';
import { Button } from '../../../components/ui/button';
import { PageTitle } from '../../../components/shared/typography';
import { FilterBar } from '../../../components/shared/filter-bar';
import { DataTable, type Column } from '../../../components/shared/data-table';
import { StatusChip } from '../../../components/shared/status-chip';

type PurchaseStatus = keyof typeof PURCHASE_ORDER_STATUS_CHIP;
const PAGE_SIZE = 20;

type PurchaseRow = {
  id: number;
  code: string;
  supplierName: string | null;
  status: PurchaseStatus;
  totalCents: number;
  createdAt: string;
};

function toPurchaseStatus(value: string): PurchaseStatus {
  if (value === 'sent' || value === 'received' || value === 'cancelled') {
    return value;
  }
  return 'draft';
}

export default function PurchasesListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = trpc.purchases.list.useQuery({
    status: statusFilter || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const rows: PurchaseRow[] = (data?.data ?? []).map(({ po, supplierName }) => ({
    id: po.id,
    code: po.code,
    supplierName: supplierName ?? null,
    status: toPurchaseStatus(po.status),
    totalCents: po.totalCents,
    createdAt: po.createdAt,
  }));

  const total = Number(data?.total ?? 0);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleRows = normalizedSearch
    ? rows.filter((row) => {
      const supplier = row.supplierName?.toLowerCase() ?? '';
      return row.code.toLowerCase().includes(normalizedSearch) || supplier.includes(normalizedSearch);
    })
    : rows;

  const columns: Column<PurchaseRow>[] = [
    {
      id: 'code',
      header: 'Pedido',
      width: '160px',
      cell: (row) => <span className="t-mono text-[var(--fg)]">{row.code}</span>,
    },
    {
      id: 'supplier',
      header: 'Fornecedor',
      width: 'flex',
      cell: (row) => (
        <span className="truncate text-sm text-[var(--fg-muted)]">{row.supplierName ?? 'Nao informado'}</span>
      ),
    },
    {
      id: 'date',
      header: 'Criado em',
      width: '130px',
      hideBelow: 'sm',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{new Date(row.createdAt).toLocaleDateString('pt-BR')}</span>,
    },
    {
      id: 'total',
      header: 'Total',
      width: '130px',
      align: 'right',
      cell: (row) => <span className="tabular-nums font-medium">{formatBRL(row.totalCents)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: '120px',
      cell: (row) => {
        const chip = PURCHASE_ORDER_STATUS_CHIP[row.status];
        return <StatusChip label={chip.label} variant={chip.variant} />;
      },
    },
    {
      id: 'actions',
      header: 'Acoes',
      width: '96px',
      align: 'right',
      cell: (row) => (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/compras/${row.id}`);
          }}
        >
          Abrir
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        subtitle="Pedidos de compra vinculados ao estoque e contas a pagar."
        actions={(
          <Button type="button" onClick={() => navigate('/compras/novo')}>
            <Plus className="size-4" aria-hidden="true" />
            Nova compra
          </Button>
        )}
      >
        Compras
      </PageTitle>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={(
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as PurchaseStatus | '');
              setPage(1);
            }}
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            aria-label="Filtrar compras por status"
          >
            <option value="">Status: Todos</option>
            <option value="draft">Rascunho</option>
            <option value="sent">Enviada</option>
            <option value="received">Recebida</option>
            <option value="cancelled">Cancelada</option>
          </select>
        )}
      />

      {error ? <p className="t-small text-[var(--destructive)]">Erro ao carregar compras: {error.message}</p> : null}

      <DataTable
        columns={columns}
        rows={visibleRows}
        getKey={(row) => row.id}
        onRowClick={(row) => navigate(`/compras/${row.id}`)}
        loading={isLoading}
        loadingRows={8}
        empty={{
          title: 'Nenhuma compra encontrada',
          description: search || statusFilter ? 'Ajuste os filtros para continuar.' : 'Registre sua primeira compra.',
          cta: (
            <Button type="button" size="sm" onClick={() => navigate('/compras/novo')}>
              Nova compra
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
              disabled={rows.length < PAGE_SIZE}
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
