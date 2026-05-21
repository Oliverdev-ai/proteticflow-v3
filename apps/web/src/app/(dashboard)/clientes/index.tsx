import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
} from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import { usePermissions } from '../../../hooks/use-permissions';
import { PageTransition } from '../../../components/shared/page-transition';
import { H1, Muted, Subtitle } from '../../../components/shared/typography';
import { DataTable, type ColumnDef } from '../../../components/shared/data-table';
import { formatBRL } from '../../../lib/format';
import { cn } from '../../../lib/utils';

type ClientRow = {
  id: number;
  name: string;
  clinic: string | null;
  phone: string | null;
  email: string | null;
  document: string | null;
  documentType: 'cpf' | 'cnpj' | null;
  status: 'active' | 'inactive';
  pendingCents: number;
};

const DOCUMENT_TYPE_LABEL: Record<'cpf' | 'cnpj', string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function formatDocument(value: string | null, type: ClientRow['documentType']): string {
  if (!value) return 'Sem documento';
  const digits = onlyDigits(value);
  if (type === 'cpf' && digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (type === 'cnpj' && digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return value;
}

function maskDocument(value: string | null, type: ClientRow['documentType']): string {
  if (!value) return 'Sem documento';
  const formatted = formatDocument(value, type);
  const visible = type === 'cnpj' ? 6 : 4;
  return `${formatted.slice(0, visible)}${'•'.repeat(Math.max(6, formatted.length - visible))}`;
}

function DebtBadge({ cents }: { cents: number }) {
  const tone = cents > 0
    ? 'border-warning/30 bg-warning/10 text-warning'
    : 'border-success/25 bg-success/10 text-success';

  return (
    <span className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-semibold font-tabular', tone)}>
      {formatBRL(cents)}
    </span>
  );
}

export default function ClientListPage() {
  const navigate = useNavigate();
  const { hasAccess } = usePermissions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [revealedDocs, setRevealedDocs] = useState<Set<number>>(new Set());

  const clientsQuery = trpc.clientes.list.useQuery({
    search: search || undefined,
    status,
    page,
    limit: 20,
  });

  const toggleMutation = trpc.clientes.toggleStatus.useMutation({
    onSuccess: () => clientsQuery.refetch(),
  });
  const deleteMutation = trpc.clientes.delete.useMutation({
    onSuccess: () => clientsQuery.refetch(),
  });

  const canDelete = hasAccess('clients.delete');
  const rows = (clientsQuery.data?.data ?? []) as ClientRow[];

  function toggleDocument(clientId: number) {
    setRevealedDocs((current) => {
      const next = new Set(current);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  const columns: ColumnDef<ClientRow>[] = [
    {
      header: 'Cliente',
      cell: (client) => (
        <Link to={`/clientes/${client.id}`} className="flex flex-col gap-1">
          <span className="font-semibold text-foreground hover:text-primary">{client.name}</span>
          <span className="text-xs text-muted-foreground">{client.clinic || 'Atendimento direto'}</span>
        </Link>
      ),
    },
    {
      header: 'Documento',
      cell: (client) => {
        const isRevealed = revealedDocs.has(client.id);
        return (
          <div className="flex items-center gap-2">
            <span className="font-tabular text-xs">
              {isRevealed
                ? formatDocument(client.document, client.documentType)
                : maskDocument(client.document, client.documentType)}
            </span>
            {client.documentType ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                {DOCUMENT_TYPE_LABEL[client.documentType]}
              </span>
            ) : null}
            {client.document ? (
              <button
                type="button"
                onClick={() => toggleDocument(client.id)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={isRevealed ? 'Mascarar documento' : 'Revelar documento'}
              >
                {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            ) : null}
          </div>
        );
      },
    },
    {
      header: 'Contato',
      hideOnMobile: true,
      cell: (client) => (
        <div className="flex flex-col gap-1 text-xs">
          <span>{client.phone || 'Sem telefone'}</span>
          <span className="text-muted-foreground">{client.email || 'Sem e-mail'}</span>
        </div>
      ),
    },
    {
      header: 'Saldo devedor',
      numeric: true,
      cell: (client) => <DebtBadge cents={client.pendingCents} />,
    },
    {
      header: 'Status',
      cell: (client) => (
        <span
          className={cn(
            'inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase',
            client.status === 'active'
              ? 'border-success/25 bg-success/10 text-success'
              : 'border-border bg-muted text-muted-foreground',
          )}
        >
          {client.status === 'active' ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      className: 'w-32',
      cell: (client) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => toggleMutation.mutate({ id: client.id })}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"
            aria-label={client.status === 'active' ? 'Inativar cliente' : 'Ativar cliente'}
          >
            {client.status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          </button>
          {canDelete ? (
            <button
              type="button"
              onClick={() => {
                if (confirm('Excluir cliente permanentemente?')) deleteMutation.mutate({ id: client.id });
              }}
              className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Excluir cliente"
            >
              <Trash2 size={17} />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  if (clientsQuery.error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-8">
        <AlertCircle className="text-destructive" size={32} />
        <p className="text-sm font-semibold text-destructive">{clientsQuery.error.message}</p>
      </div>
    );
  }

  return (
    <PageTransition className="mx-auto flex h-full max-w-7xl flex-col gap-8 overflow-auto p-4 md:p-1">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users size={24} />
          </div>
          <div>
            <H1>Clientes</H1>
            <Subtitle>Carteira comercial, saldo e documentos sensíveis</Subtitle>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/clientes/novo')}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-semibold uppercase tracking-wide text-primary-foreground shadow-lg shadow-primary/20"
        >
          <Plus size={16} />
          Novo cliente
        </button>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-4">
        <label className="relative min-w-[260px] flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome, documento ou telefone"
            className="input-field pl-11"
          />
        </label>
        <select
          value={status ?? ''}
          onChange={(event) => {
            setStatus((event.target.value as 'active' | 'inactive' | '') || undefined);
            setPage(1);
          }}
          className="input-field w-full sm:w-56"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      <DataTable<ClientRow>
        columns={columns}
        data={rows}
        rowKey={(client) => client.id}
        loading={clientsQuery.isLoading}
        density={density}
        onDensityChange={setDensity}
        emptyMessage="Nenhum cliente encontrado."
        emptyAction={
          <button
            type="button"
            onClick={() => navigate('/clientes/novo')}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
          >
            Cadastrar cliente
          </button>
        }
        pagination={{
          page,
          pageSize: 20,
          total: clientsQuery.data?.total ?? 0,
          onChange: setPage,
        }}
      />

      <Muted className="text-xs">
        Documentos fiscais ficam mascarados por padrão. Use revelar apenas quando necessário.
      </Muted>
    </PageTransition>
  );
}
