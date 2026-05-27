import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PURCHASE_ORDER_STATUS_CHIP } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { formatBRL } from '../../../lib/format';
import { usePermissions } from '../../../hooks/use-permissions';
import { Button } from '../../../components/ui/button';
import { PageTitle } from '../../../components/shared/typography';
import { FilterBar } from '../../../components/shared/filter-bar';
import { DataTable, type Column } from '../../../components/shared/data-table';
import { StatusChip } from '../../../components/shared/status-chip';

type PurchaseOrderStatus = keyof typeof PURCHASE_ORDER_STATUS_CHIP;
const PAGE_SIZE = 20;

type PurchaseOrderRow = {
  id: number;
  code: string;
  status: PurchaseOrderStatus;
  totalCents: number;
  createdAt: string;
  receivedAt: string | null;
};

function toPurchaseOrderStatus(value: string): PurchaseOrderStatus {
  if (value === 'sent' || value === 'received' || value === 'cancelled') {
    return value;
  }
  return 'draft';
}

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { role } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('');
  const [page, setPage] = useState(1);

  const canManageStatus = role === 'superadmin' || role === 'gerente';

  const { data, isLoading, error } = trpc.inventory.listPOs.useQuery({
    status: statusFilter || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const changePOStatus = trpc.inventory.changePOStatus.useMutation({
    onSuccess: async () => {
      await utils.inventory.listPOs.invalidate();
    },
  });

  const rows: PurchaseOrderRow[] = (data?.data ?? []).map((po) => ({
    id: po.id,
    code: po.code,
    status: toPurchaseOrderStatus(po.status),
    totalCents: po.totalCents,
    createdAt: po.createdAt,
    receivedAt: po.receivedAt ? po.receivedAt.toString() : null,
  }));

  const total = Number(data?.total ?? 0);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleRows = normalizedSearch
    ? rows.filter((row) => row.code.toLowerCase().includes(normalizedSearch))
    : rows;

  const columns: Column<PurchaseOrderRow>[] = [
    {
      id: 'code',
      header: 'OC',
      width: '160px',
      cell: (row) => <span className="t-mono text-[var(--fg)]">{row.code}</span>,
    },
    {
      id: 'createdAt',
      header: 'Criada em',
      width: '130px',
      hideBelow: 'sm',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{new Date(row.createdAt).toLocaleDateString('pt-BR')}</span>,
    },
    {
      id: 'total',
      header: 'Valor total',
      width: '140px',
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
      width: '220px',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          {canManageStatus && row.status === 'draft' ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={changePOStatus.isPending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                changePOStatus.mutate({ id: row.id, status: 'sent' });
              }}
            >
              Enviar
            </Button>
          ) : null}

          {canManageStatus && row.status === 'sent' ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={changePOStatus.isPending}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                changePOStatus.mutate({ id: row.id, status: 'received' });
              }}
            >
              Receber
            </Button>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/estoque/oc/${row.id}`);
            }}
          >
            Detalhes
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        subtitle="Acompanhamento do ciclo de compra e recebimento de insumos."
        actions={(
          <Button type="button" variant="secondary" onClick={() => navigate('/estoque')}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            Voltar
          </Button>
        )}
      >
        Ordens de compra
      </PageTitle>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={(
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as PurchaseOrderStatus | '');
              setPage(1);
            }}
            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            aria-label="Filtrar ordens de compra por status"
          >
            <option value="">Status: Todos</option>
            <option value="draft">Rascunho</option>
            <option value="sent">Enviada</option>
            <option value="received">Recebida</option>
            <option value="cancelled">Cancelada</option>
          </select>
        )}
      />

      {error ? <p className="t-small text-[var(--destructive)]">Erro ao carregar ordens de compra: {error.message}</p> : null}

      <DataTable
        columns={columns}
        rows={visibleRows}
        getKey={(row) => row.id}
        onRowClick={(row) => navigate(`/estoque/oc/${row.id}`)}
        loading={isLoading}
        loadingRows={8}
        empty={{
          title: 'Nenhuma ordem de compra encontrada',
          description: statusFilter ? 'Ajuste os filtros para continuar.' : 'Registre uma nova ordem de compra em Estoque > Compras.',
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
