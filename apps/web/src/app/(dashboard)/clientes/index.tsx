import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, Search, ToggleLeft, ToggleRight, Trash2, AlertCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import { usePermissions } from '../../../hooks/use-permissions';
import { PageTransition } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted } from '../../../components/shared/typography';
import { EmptyState } from '../../../components/shared/empty-state';
import { cn } from '../../../lib/utils';

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
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="animate-spin text-primary" size={32} />
        <Muted>Carregando parceiros...</Muted>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 p-8 bg-destructive/5 rounded-3xl border border-destructive/20">
        <AlertCircle className="text-destructive font-black" size={32} />
        <div className="text-center">
          <p className="text-destructive font-bold text-sm uppercase tracking-widest">{error.message}</p>
          <button 
            onClick={() => refetch()} 
            className="mt-4 text-xs font-black text-primary hover:text-primary/80 transition-all uppercase tracking-[0.2em] underline underline-offset-4"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/5">
            <Users className="text-primary" size={24} />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <H1>Parceiros</H1>
              {data?.total !== undefined && (
                <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                  {data.total}
                </span>
              )}
            </div>
            <Subtitle>Gerencie dentistas, clínicas e laboratórios parceiros</Subtitle>
          </div>
        </div>
        <button
          onClick={() => navigate('/clientes/novo')}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-black px-6 py-3 rounded-2xl transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 uppercase tracking-[0.2em]"
        >
          <Plus size={16} strokeWidth={3} /> Cadastrar Parceiro
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-card/50 p-4 rounded-3xl border border-border/50 backdrop-blur-sm">
        <div className="relative flex-1 min-w-[280px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome, clínica, CPF/CNPJ..."
            className="w-full bg-muted border border-border rounded-2xl pl-12 pr-4 py-3 text-foreground placeholder:text-muted-foreground/30 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 bg-muted border border-border rounded-2xl px-4 py-1.5 min-w-[180px]">
          <div className="p-1.5 bg-background rounded-lg text-muted-foreground"><Users size={14} /></div>
          <select
            value={status ?? ''}
            onChange={e => { setStatus(e.target.value as 'active' | 'inactive' | undefined || undefined); setPage(1); }}
            className="bg-transparent border-none text-foreground text-[10px] font-black uppercase tracking-widest focus:outline-none flex-1 cursor-pointer"
          >
            <option value="">TODOS OS STATUS</option>
            <option value="active">ATIVOS APENAS</option>
            <option value="inactive">INATIVOS APENAS</option>
          </select>
        </div>
      </div>

      {/* Body Content */}
      {data?.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum parceiro encontrado"
          description={search ? "Ajuste seus filtros de busca para encontrar o que procura." : "Comece cadastrando seu primeiro parceiro de trabalho."}
        >
          <button 
            onClick={() => search ? setSearch('') : navigate('/clientes/novo')}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-[10px] font-black px-6 py-3 rounded-2xl transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 uppercase tracking-[0.2em]"
          >
            {search ? "Limpar Busca" : "Novo Parceiro"}
          </button>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Table Container */}
          <div className="premium-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Nome completo</th>
                    <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4 hidden md:table-cell">Clínica / Empresa</th>
                    <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4 hidden sm:table-cell">Contato</th>
                    <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map((client, idx) => (
                    <tr 
                      key={client.id} 
                      className={cn(
                        "group border-b border-border/50 hover:bg-primary/[0.02] transition-colors",
                        idx === (data.data.length - 1) ? 'border-0' : ''
                      )}
                    >
                      <td className="px-6 py-5">
                        <Link to={`/clientes/${client.id}`} className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{client.name}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">{client.document || 'Sem registro'}</span>
                        </Link>
                      </td>
                      <td className="px-6 py-5 hidden md:table-cell">
                        <span className="text-xs font-semibold text-muted-foreground">{client.clinic || 'Direto'}</span>
                      </td>
                      <td className="px-6 py-5 hidden sm:table-cell text-xs font-bold text-foreground opacity-80">
                        {client.phone || 'N/A'}
                      </td>
                      <td className="px-6 py-5">
                        <span className={cn(
                          "inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border",
                          client.status === 'active' 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                            : 'bg-muted text-muted-foreground border-border'
                        )}>
                          <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", client.status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                          {client.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => toggleMutation.mutate({ id: client.id })}
                            className={cn(
                              "p-2 rounded-xl transition-all border border-transparent hover:border-primary/20",
                              client.status === 'active' ? 'text-primary' : 'text-muted-foreground opacity-50'
                            )}
                          >
                            {client.status === 'active' ? <ToggleRight size={20} strokeWidth={2.5} /> : <ToggleLeft size={20} strokeWidth={2.5} />}
                          </button>
                          <div className="w-px h-4 bg-border/50 mx-1" />
                          {canDelete && (
                            <button
                              onClick={() => { if (confirm('Excluir cliente permanentemente?')) deleteMutation.mutate({ id: client.id }); }}
                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                           <button onClick={() => navigate(`/clientes/${client.id}`)} className="p-2 text-muted-foreground hover:text-primary transition-all">
                            <ChevronRight size={18} strokeWidth={3} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data && data.total > 20 && (
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Mostrando <span className="text-foreground">{((page - 1) * 20) + 1} – {Math.min(page * 20, data.total)}</span> de <span className="text-foreground">{data.total}</span>
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                  className="p-2 bg-card border border-border rounded-xl text-muted-foreground disabled:opacity-30 hover:text-primary transition-all active:scale-95 shadow-sm"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="bg-muted px-4 py-2 rounded-xl border border-border text-xs font-black flex items-center">
                  PÁGINA {page}
                </div>
                <button 
                  onClick={() => setPage(p => p + 1)} 
                  disabled={page * 20 >= data.total}
                  className="p-2 bg-card border border-border rounded-xl text-muted-foreground disabled:opacity-30 hover:text-primary transition-all active:scale-95 shadow-sm"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </PageTransition>
  );
}
