import { useState } from 'react';
import { Plus, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { formatBRL } from '../../../lib/format';
import { cn } from '../../../lib/utils';
import { PageTitle } from '../../../components/shared/typography';
import { FilterBar } from '../../../components/shared/filter-bar';
import { DataTable, type Column } from '../../../components/shared/data-table';
import { StatusChip } from '../../../components/shared/status-chip';
import { Button } from '../../../components/ui/button';

type EmployeeRow = {
  id: number;
  name: string;
  email: string | null;
  type: string;
  contractType: string;
  baseSalaryCents: number;
  defaultCommissionPercent: number;
  isActive: boolean;
};

export default function FuncionariosIndex() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const { data, isLoading, error } = trpc.employee.list.useQuery({
    search,
    isActive: !showInactive,
  });

  const rows: EmployeeRow[] = (data?.data ?? []).map((emp) => ({
    id: emp.id,
    name: emp.name,
    email: emp.email ?? null,
    type: emp.type,
    contractType: emp.contractType,
    baseSalaryCents: emp.baseSalaryCents ?? 0,
    defaultCommissionPercent: Number(emp.defaultCommissionPercent),
    isActive: emp.isActive,
  }));

  const columns: Column<EmployeeRow>[] = [
    {
      id: 'employee',
      header: 'Funcionario',
      width: 'flex',
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-muted)] text-sm font-semibold text-[var(--fg)]">
            {row.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-medium">{row.name}</span>
            <span className="t-small text-[var(--fg-muted)]">{row.email ?? '—'}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Tipo/Contrato',
      width: '180px',
      hideBelow: 'md',
      cell: (row) => (
        <div>
          <span className="block t-small capitalize">{row.type}</span>
          <span className="t-micro text-[var(--fg-muted)] uppercase">{row.contractType}</span>
        </div>
      ),
    },
    {
      id: 'salary',
      header: 'Salario base',
      width: '140px',
      hideBelow: 'sm',
      align: 'right',
      cell: (row) => <span className="tabular-nums">{formatBRL(row.baseSalaryCents)}</span>,
    },
    {
      id: 'commission',
      header: 'Comissao',
      width: '108px',
      align: 'right',
      cell: (row) => <span className="tabular-nums">{row.defaultCommissionPercent}%</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: '108px',
      cell: (row) => (
        <StatusChip
          label={row.isActive ? 'Ativo' : 'Inativo'}
          variant={row.isActive ? 'success' : 'neutral'}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        subtitle="Gerencie equipe, comissoes e atribuicoes."
        actions={(
          <Button type="button" onClick={() => navigate('/funcionarios/novo')}>
            <Plus className="size-4" aria-hidden="true" />
            Novo funcionario
          </Button>
        )}
      >
        Funcionarios
      </PageTitle>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        actions={(
          <button
            type="button"
            onClick={() => setShowInactive((prev) => !prev)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]',
              showInactive
                ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--fg-on-primary)]'
                : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] hover:bg-[var(--bg-muted)]',
            )}
          >
            <UserX className="size-4" aria-hidden="true" />
            {showInactive ? 'Ver ativos' : 'Ver inativos'}
          </button>
        )}
      />

      {error ? (
        <p className="t-small text-[var(--destructive)]">Erro ao carregar funcionarios: {error.message}</p>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.id}
        onRowClick={(row) => navigate(`/funcionarios/${row.id}`)}
        loading={isLoading}
        loadingRows={8}
        empty={{
          title: 'Nenhum funcionario encontrado',
          description: 'Ajuste os filtros para continuar.',
          cta: (
            <Button type="button" size="sm" onClick={() => navigate('/funcionarios/novo')}>
              Novo funcionario
            </Button>
          ),
        }}
      />
    </div>
  );
}
