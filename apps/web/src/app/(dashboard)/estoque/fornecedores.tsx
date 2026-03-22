import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { Users, Search, Plus, ToggleLeft, ToggleRight, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', cnpj: '', email: '', phone: '', contact: '' });
  const utils = trpc.useUtils();

  const { data } = trpc.inventory.listSuppliers.useQuery({ search: search || undefined, page: 1, limit: 50 });
  const createSupplier = trpc.inventory.createSupplier.useMutation({
    onSuccess: () => { utils.inventory.listSuppliers.invalidate(); setCreateOpen(false); setForm({ name: '', cnpj: '', email: '', phone: '', contact: '' }); },
  });
  const toggleSupplier = trpc.inventory.toggleSupplier.useMutation({ onSuccess: () => utils.inventory.listSuppliers.invalidate() });

  const suppliers = data?.data ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/estoque" className="text-neutral-400 hover:text-white"><ChevronLeft size={20} /></Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users size={22} className="text-violet-500" />Fornecedores</h1>
        <div className="flex-1" />
        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Novo Fornecedor
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar fornecedor..." className="w-full pl-9 pr-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500" />
      </div>

      <div className="space-y-3">
        {suppliers.length === 0 && <p className="text-neutral-500 text-center py-10">Nenhum fornecedor cadastrado</p>}
        {suppliers.map(s => (
          <div key={s.id} className={`bg-neutral-900 border rounded-xl px-5 py-4 flex items-center justify-between ${s.isActive ? 'border-neutral-800' : 'border-neutral-800 opacity-60'}`}>
            <div>
              <p className="text-white font-medium">{s.name}</p>
              <div className="flex gap-3 mt-1 text-xs text-neutral-500">
                {s.cnpj && <span>CNPJ: {s.cnpj}</span>}
                {s.email && <span>{s.email}</span>}
                {s.phone && <span>{s.phone}</span>}
              </div>
            </div>
            <button onClick={() => toggleSupplier.mutate({ id: s.id })} className="text-neutral-500 hover:text-white transition-colors">
              {s.isActive ? <ToggleRight size={22} className="text-violet-400" /> : <ToggleLeft size={22} />}
            </button>
          </div>
        ))}
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-white">Novo Fornecedor</h2>
            {[
              { key: 'name', label: 'Nome *', placeholder: 'Nome da empresa' },
              { key: 'cnpj', label: 'CNPJ', placeholder: '00.000.000/0000-00' },
              { key: 'email', label: 'E-mail', placeholder: 'contato@empresa.com' },
              { key: 'phone', label: 'Telefone', placeholder: '(11) 99999-9999' },
              { key: 'contact', label: 'Contato', placeholder: 'Nome do responsável' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-neutral-400 mb-1">{label}</label>
                <input
                  value={(form as Record<string, string>)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm placeholder-neutral-600"
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setCreateOpen(false)} className="flex-1 px-4 py-2 border border-neutral-700 text-neutral-300 rounded-lg text-sm hover:bg-neutral-800 transition-colors">Cancelar</button>
              <button
                onClick={() => createSupplier.mutate({ name: form.name, cnpj: form.cnpj || undefined, email: form.email || undefined, phone: form.phone || undefined, contact: form.contact || undefined })}
                disabled={!form.name.trim() || createSupplier.isPending}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {createSupplier.isPending ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
