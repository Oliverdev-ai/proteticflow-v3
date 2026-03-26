import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, Search, ToggleLeft, ToggleRight, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import { usePermissions } from '../../../hooks/use-permissions';

export default function ClientListPage() {
  const navigate = useNavigate();
  const { hasAccess } = usePermissions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = trpc.clientes.list.useQuery({
    search: search || undefined,
    status,
    page,
    limit: 20,
  });

  const toggleMutation = trpc.clientes.toggleStatus.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = trpc.clientes.delete.useMutation({ onSuccess: () => refetch() });

  const canDelete = hasAccess('clients.delete');

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-violet-400" size={32} />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="text-red-400" size={32} />
        <p className="text-red-400 text-sm">{error.message}</p>
        <button onClick={() => refetch()} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="text-violet-400" size={22} />
          <h1 className="text-xl font-bold text-white">Clientes</h1>
          {data?.total !== undefined && (
            <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full">{data.total}</span>
          )}
        </div>
        <button
          onClick={() => navigate('/clientes/novo')}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome, documento ou telefone..."
            className="w-full bg-neutral-800 border border-neutral-700 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>
        <select
          value={status ?? ''}
          onChange={e => { setStatus(e.target.value as 'active' | 'inactive' | undefined || undefined); setPage(1); }}
          className="bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors"
        >
          <option value="">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>

      {/* Empty */}
      {data?.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Users size={40} className="text-neutral-700" />
          <p className="text-neutral-500 text-sm">Nenhum cliente encontrado.</p>
          <button onClick={() => navigate('/clientes/novo')} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
            + Adicionar primeiro cliente
          </button>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left text-xs font-semibold text-neutral-500 px-5 py-3">Nome</th>
                  <th className="text-left text-xs font-semibold text-neutral-500 px-5 py-3 hidden md:table-cell">Clínica</th>
                  <th className="text-left text-xs font-semibold text-neutral-500 px-5 py-3 hidden sm:table-cell">Telefone</th>
                  <th className="text-left text-xs font-semibold text-neutral-500 px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((client, idx) => (
                  <tr key={client.id} className={`border-b border-neutral-800/50 hover:bg-neutral-800/40 transition-colors ${idx === (data.data.length - 1) ? 'border-0' : ''}`}>
                    <td className="px-5 py-3.5">
                      <Link to={`/clientes/${client.id}`} className="text-white text-sm font-medium hover:text-violet-400 transition-colors">
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-neutral-400 text-sm">{client.clinic || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className="text-neutral-400 text-sm">{client.phone || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${client.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-neutral-700/50 text-neutral-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${client.status === 'active' ? 'bg-green-400' : 'bg-neutral-500'}`} />
                        {client.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => toggleMutation.mutate({ id: client.id })}
                          title={client.status === 'active' ? 'Desativar' : 'Ativar'}
                          className="text-neutral-500 hover:text-violet-400 transition-colors"
                        >
                          {client.status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => { if (confirm('Excluir cliente permanentemente?')) deleteMutation.mutate({ id: client.id }); }}
                            className="text-neutral-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.total > 20 && (
            <div className="flex items-center justify-between text-sm text-neutral-400">
              <span>Mostrando {((page - 1) * 20) + 1}–{Math.min(page * 20, data.total)} de {data.total}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 bg-neutral-800 rounded-lg disabled:opacity-40 hover:bg-neutral-700 transition-colors">← Anterior</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= data.total}
                  className="px-3 py-1.5 bg-neutral-800 rounded-lg disabled:opacity-40 hover:bg-neutral-700 transition-colors">Próximo →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
