import { useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
import { PageTitle } from '../../../components/shared/typography';
import { FilterBar } from '../../../components/shared/filter-bar';
import { DataTable, type Column } from '../../../components/shared/data-table';
import { StatusChip } from '../../../components/shared/status-chip';

const PAGE_SIZE = 20;

type MaterialRow = {
  id: number;
  name: string;
  code: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  isLow: boolean;
};

export default function MaterialsPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [belowMin, setBelowMin] = useState(false);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    unit: 'un',
    minStock: 0,
    initialQuantity: 0,
    unitCostCents: 0,
  });

  const { data, isLoading, error } = trpc.inventory.listMaterials.useQuery({
    search: search || undefined,
    belowMinimum: belowMin || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const createMaterial = trpc.inventory.createMaterial.useMutation({
    onSuccess: async () => {
      await utils.inventory.listMaterials.invalidate();
      setCreateOpen(false);
      setForm({
        name: '',
        code: '',
        unit: 'un',
        minStock: 0,
        initialQuantity: 0,
        unitCostCents: 0,
      });
    },
  });

  const rows: MaterialRow[] = (data?.data ?? []).map((mat) => {
    const currentStock = Number(mat.currentStock);
    const minStock = Number(mat.minStock);
    const isLow = minStock > 0 && currentStock < minStock;

    return {
      id: mat.id,
      name: mat.name,
      code: mat.code ?? null,
      unit: mat.unit,
      currentStock,
      minStock,
      isLow,
    };
  });

  const total = Number(data?.total ?? 0);

  const columns: Column<MaterialRow>[] = [
    {
      id: 'name',
      header: 'Material',
      width: 'flex',
      cell: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium">{row.name}</span>
          {row.isLow ? <span className="t-micro text-[var(--destructive)]">Reposicao urgente</span> : null}
        </div>
      ),
    },
    {
      id: 'code',
      header: 'SKU',
      width: '160px',
      hideBelow: 'md',
      cell: (row) => <span className="t-mono text-[var(--fg-muted)]">{row.code ?? 'SEM CODIGO'}</span>,
    },
    {
      id: 'unit',
      header: 'Unidade',
      width: '100px',
      hideBelow: 'sm',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{row.unit}</span>,
    },
    {
      id: 'stock',
      header: 'Estoque',
      width: '110px',
      align: 'right',
      cell: (row) => <span className="tabular-nums font-medium">{row.currentStock}</span>,
    },
    {
      id: 'minStock',
      header: 'Estoque min.',
      width: '120px',
      align: 'right',
      hideBelow: 'sm',
      cell: (row) => <span className="tabular-nums text-[var(--fg-muted)]">{row.minStock}</span>,
    },
    {
      id: 'status',
      header: 'Alerta',
      width: '112px',
      cell: (row) => (
        <StatusChip
          label={row.isLow ? 'Critico' : 'OK'}
          variant={row.isLow ? 'destructive' : 'neutral'}
        />
      ),
    },
    {
      id: 'action',
      header: 'Acoes',
      width: '96px',
      align: 'right',
      cell: (row) => (
        <Link
          to={`/estoque/material/${row.id}`}
          className="t-small rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-[var(--primary)] hover:bg-[var(--bg-muted)]"
          onClick={(event) => event.stopPropagation()}
        >
          Detalhes
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        subtitle="Gestao tecnica de insumos e ponto de pedido."
        actions={(
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/estoque')}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Voltar
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Registrar material
            </Button>
          </div>
        )}
      >
        Catalogo de materiais
      </PageTitle>

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        actions={(
          <button
            type="button"
            onClick={() => {
              setBelowMin((prev) => !prev);
              setPage(1);
            }}
            aria-pressed={belowMin}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
              belowMin
                ? 'border-[var(--destructive)] bg-[var(--destructive)] text-white'
                : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] hover:bg-[var(--bg-muted)]',
            )}
          >
            <AlertTriangle className="size-4" aria-hidden="true" />
            Estoque critico
          </button>
        )}
      />

      {error ? (
        <p className="t-small text-[var(--destructive)]">Erro ao carregar materiais: {error.message}</p>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.id}
        onRowClick={(row) => navigate(`/estoque/material/${row.id}`)}
        loading={isLoading}
        loadingRows={8}
        empty={{
          title: 'Nenhum material encontrado',
          description: search || belowMin ? 'Ajuste os filtros para continuar.' : 'Registre seu primeiro material.',
          cta: (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              Registrar material
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

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-lg)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-[var(--font-display)] text-2xl text-[var(--fg-strong)]">Novo material</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)]"
                aria-label="Fechar"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="t-small text-[var(--fg-muted)]">Nome*</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ex: Resina Z350 XT A2B"
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="t-small text-[var(--fg-muted)]">SKU</span>
                <input
                  value={form.code}
                  onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="t-small text-[var(--fg-muted)]">Unidade</span>
                <input
                  value={form.unit}
                  onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="t-small text-[var(--fg-muted)]">Estoque minimo</span>
                <input
                  type="number"
                  min={0}
                  value={form.minStock}
                  onChange={(event) => setForm((prev) => ({ ...prev, minStock: Number(event.target.value) || 0 }))}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="t-small text-[var(--fg-muted)]">Quantidade inicial</span>
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  value={form.initialQuantity}
                  onChange={(event) => setForm((prev) => ({ ...prev, initialQuantity: Number(event.target.value) || 0 }))}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                />
              </label>

              <label className="space-y-1.5 md:col-span-2">
                <span className="t-small text-[var(--fg-muted)]">Custo unitario (R$)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.unitCostCents === 0 ? '' : (form.unitCostCents / 100).toString()}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    const nextCents = Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
                    setForm((prev) => ({ ...prev, unitCostCents: nextCents }));
                  }}
                  placeholder="0.00"
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={!form.name.trim()}
                loading={createMaterial.isPending}
                onClick={() =>
                  createMaterial.mutate({
                    name: form.name,
                    code: form.code || undefined,
                    unit: form.unit,
                    minStock: form.minStock,
                    initialQuantity: form.initialQuantity,
                    unitCostCents: form.unitCostCents,
                  })
                }
              >
                Salvar material
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
