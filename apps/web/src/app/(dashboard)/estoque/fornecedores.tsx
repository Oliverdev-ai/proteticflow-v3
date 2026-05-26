import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Power, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { Button } from '../../../components/ui/button';
import { PageTitle } from '../../../components/shared/typography';
import { FilterBar } from '../../../components/shared/filter-bar';
import { DataTable, type Column } from '../../../components/shared/data-table';
import { StatusChip } from '../../../components/shared/status-chip';

const PAGE_SIZE = 20;

type SupplierRow = {
  id: number;
  name: string;
  cnpj: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
};

export default function SuppliersPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', cnpj: '', email: '', phone: '', contact: '' });

  const { data, isLoading, error } = trpc.inventory.listSuppliers.useQuery({
    search: search || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const createSupplier = trpc.inventory.createSupplier.useMutation({
    onSuccess: async () => {
      await utils.inventory.listSuppliers.invalidate();
      setCreateOpen(false);
      setForm({ name: '', cnpj: '', email: '', phone: '', contact: '' });
    },
  });

  const toggleSupplier = trpc.inventory.toggleSupplier.useMutation({
    onSuccess: async () => {
      await utils.inventory.listSuppliers.invalidate();
    },
  });

  const rows: SupplierRow[] = (data?.data ?? []).map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    cnpj: supplier.cnpj ?? null,
    contact: supplier.contact ?? null,
    email: supplier.email ?? null,
    phone: supplier.phone ?? null,
    isActive: supplier.isActive,
  }));

  const total = Number(data?.total ?? 0);

  const columns: Column<SupplierRow>[] = [
    {
      id: 'name',
      header: 'Fornecedor',
      width: 'flex',
      cell: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium">{row.name}</span>
          <span className="t-small text-[var(--fg-muted)]">{row.contact ?? 'Sem responsavel'}</span>
        </div>
      ),
    },
    {
      id: 'cnpj',
      header: 'CNPJ',
      width: '180px',
      hideBelow: 'md',
      cell: (row) => <span className="t-mono text-[var(--fg-muted)]">{row.cnpj ?? '-'}</span>,
    },
    {
      id: 'contact',
      header: 'Contato',
      width: '220px',
      hideBelow: 'sm',
      cell: (row) => (
        <div className="min-w-0">
          <span className="block truncate t-small">{row.email ?? 'Sem e-mail'}</span>
          <span className="t-small text-[var(--fg-muted)]">{row.phone ?? 'Sem telefone'}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: '110px',
      cell: (row) => (
        <StatusChip
          label={row.isActive ? 'Ativo' : 'Inativo'}
          variant={row.isActive ? 'success' : 'neutral'}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Acoes',
      width: '96px',
      align: 'right',
      cell: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleSupplier.mutate({ id: row.id });
          }}
          disabled={toggleSupplier.isPending}
          aria-label={row.isActive ? 'Desativar fornecedor' : 'Ativar fornecedor'}
          className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] disabled:opacity-50"
        >
          <Power className="size-4" aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        subtitle="Gestao da base de fornecedores e parceiros comerciais."
        actions={(
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/estoque')}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Voltar
            </Button>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Novo fornecedor
            </Button>
          </div>
        )}
      >
        Fornecedores
      </PageTitle>

      <FilterBar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />

      {error ? <p className="t-small text-[var(--destructive)]">Erro ao carregar fornecedores: {error.message}</p> : null}

      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.id}
        loading={isLoading}
        loadingRows={8}
        empty={{
          title: 'Nenhum fornecedor encontrado',
          description: search ? 'Ajuste os filtros para continuar.' : 'Registre seu primeiro fornecedor.',
          cta: (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              Novo fornecedor
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
              <h2 className="font-[var(--font-display)] text-2xl text-[var(--fg-strong)]">Novo fornecedor</h2>
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
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="t-small text-[var(--fg-muted)]">CNPJ</span>
                <input
                  value={form.cnpj}
                  onChange={(event) => setForm((prev) => ({ ...prev, cnpj: event.target.value }))}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="t-small text-[var(--fg-muted)]">Responsavel</span>
                <input
                  value={form.contact}
                  onChange={(event) => setForm((prev) => ({ ...prev, contact: event.target.value }))}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="t-small text-[var(--fg-muted)]">E-mail</span>
                <input
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="t-small text-[var(--fg-muted)]">Telefone</span>
                <input
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
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
                loading={createSupplier.isPending}
                disabled={!form.name.trim()}
                onClick={() =>
                  createSupplier.mutate({
                    name: form.name,
                    cnpj: form.cnpj || undefined,
                    email: form.email || undefined,
                    phone: form.phone || undefined,
                    contact: form.contact || undefined,
                  })
                }
              >
                Salvar fornecedor
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
