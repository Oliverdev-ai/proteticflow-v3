import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Plus, Search, Loader2, AlertCircle, Star } from 'lucide-react';
import { trpc } from '../../../lib/trpc';

export default function PricingTablesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data, isLoading, error, refetch } = trpc.pricing.listTables.useQuery({ search: search || undefined, page: 1, limit: 20 });
  const createMutation = trpc.pricing.createTable.useMutation({ onSuccess: () => refetch() });
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertCircle className="text-red-400" size={32} />
      <p className="text-red-400 text-sm">{error.message}</p>
      <button onClick={() => refetch()} className="text-xs text-primary hover:text-primary transition-colors">Tentar novamente</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="text-primary" size={22} />
          <h1 className="text-xl font-bold text-white">Tabelas de Preços</h1>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{data?.total ?? 0}</span>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-primary hover:bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={16} /> Nova tabela
        </button>
      </div>

      {/* Quick create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-white font-semibold">Nova Tabela de Preços</h2>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome da tabela" className="input-field w-full" autoFocus />
            <div className="flex gap-3">
              <button onClick={() => { setShowCreate(false); setNewName(''); }} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-colors">Cancelar</button>
              <button
                disabled={!newName.trim() || createMutation.isPending}
                onClick={() => { createMutation.mutate({ name: newName.trim(), isDefault: false }); setShowCreate(false); setNewName(''); }}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tabela..." className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-primary transition-colors" />
      </div>

      {data?.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <DollarSign size={40} className="text-zinc-700" />
          <p className="text-zinc-500 text-sm">Nenhuma tabela de preços.</p>
          <button onClick={() => setShowCreate(true)} className="text-xs text-primary hover:text-primary transition-colors">+ Criar primeira tabela</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.data.map(table => (
            <button key={table.id} onClick={() => navigate(`/precos/${table.id}`)}
              className="bg-zinc-900 border border-zinc-800 hover:border-primary/50 rounded-2xl p-5 text-left transition-colors group">
              <div className="flex items-start justify-between mb-3">
                <span className="text-white font-semibold text-sm group-hover:text-primary transition-colors">{table.name}</span>
                {table.isDefault && <Star size={14} className="text-amber-400 flex-shrink-0" fill="currentColor" />}
              </div>
              {table.description && <p className="text-zinc-500 text-xs line-clamp-2">{table.description}</p>}
              <p className="text-xs text-zinc-600 mt-3">Ver itens →</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
