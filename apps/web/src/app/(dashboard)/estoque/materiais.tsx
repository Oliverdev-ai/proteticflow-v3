import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { Package, Search, Plus, AlertTriangle, ArrowRight, ChevronLeft } from 'lucide-react';

export default function MaterialsPage() {
  const [search, setSearch] = useState('');
  const [belowMin, setBelowMin] = useState(false);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', unit: 'un', minStock: 0 });

  const utils = trpc.useUtils();
  const { data } = trpc.inventory.listMaterials.useQuery({ search: search || undefined, belowMinimum: belowMin || undefined, page, limit: 20 });

  const createMaterial = trpc.inventory.createMaterial.useMutation({
    onSuccess: () => { utils.inventory.listMaterials.invalidate(); setCreateOpen(false); setForm({ name: '', code: '', unit: 'un', minStock: 0 }); },
  });

  const materials = data?.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/estoque" className="text-neutral-400 hover:text-white"><ChevronLeft size={20} /></Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Package size={22} className="text-violet-500" />Materiais</h1>
        <div className="flex-1" />
        <button
          onClick={() => setBelowMin(b => !b)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${belowMin ? 'bg-red-900/40 text-red-300 border border-red-700' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'}`}
        >
          <AlertTriangle size={12} /> Abaixo do mínimo
        </button>
        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Novo Material
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, código ou barcode..."
          className="w-full pl-9 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500"
        />
      </div>

      {/* Table */}
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-800 text-neutral-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Material</th>
              <th className="text-left px-4 py-3 font-medium">Código</th>
              <th className="text-left px-4 py-3 font-medium">Unidade</th>
              <th className="text-right px-4 py-3 font-medium">Estoque Atual</th>
              <th className="text-right px-4 py-3 font-medium">Mínimo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {materials.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-neutral-500">Nenhum material encontrado</td></tr>
            )}
            {materials.map((mat: typeof materials[number]) => {
              const stock = Number(mat.currentStock);
              const min = Number(mat.minStock);
              const isLow = min > 0 && stock < min;
              return (
                <tr key={mat.id} className="hover:bg-neutral-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isLow && <AlertTriangle size={13} className="text-red-400 shrink-0" />}
                      <span className={`font-medium ${isLow ? 'text-red-300' : 'text-white'}`}>{mat.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{mat.code ?? '-'}</td>
                  <td className="px-4 py-3 text-neutral-400">{mat.unit}</td>
                  <td className={`px-4 py-3 text-right font-medium ${isLow ? 'text-red-400' : 'text-white'}`}>{stock}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">{min}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/estoque/material/${mat.id}`} className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-1 text-xs">
                      Detalhes <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(data?.total ?? 0) > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-neutral-800 text-neutral-300 rounded disabled:opacity-40 text-sm">Anterior</button>
          <span className="px-3 py-1 text-sm text-neutral-400">Página {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={materials.length < 20} className="px-3 py-1 bg-neutral-800 text-neutral-300 rounded disabled:opacity-40 text-sm">Próxima</button>
        </div>
      )}

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-white">Novo Material</h2>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Nome *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Código</label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Unidade</label>
                <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Estoque Mínimo</label>
              <input type="number" min="0" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: Number(e.target.value) }))} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setCreateOpen(false)} className="flex-1 px-4 py-2 border border-neutral-700 text-neutral-300 rounded-lg text-sm hover:bg-neutral-800 transition-colors">Cancelar</button>
              <button
                onClick={() => createMaterial.mutate({ name: form.name, code: form.code || undefined, unit: form.unit, minStock: form.minStock })}
                disabled={!form.name.trim() || createMaterial.isPending}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {createMaterial.isPending ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
