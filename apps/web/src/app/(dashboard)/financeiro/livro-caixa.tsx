import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { Plus, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const EMPTY_FORM = { type: 'credit' as 'credit' | 'debit', amountCents: '', description: '', referenceDate: '' };

export default function LivroCaixaPage() {
  const utils = trpc.useUtils();
  const [typeFilter, setTypeFilter] = useState<'credit' | 'debit' | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data, isLoading } = trpc.financial.listCashbook.useQuery({ type: typeFilter, page: 1, limit: 100 });

  const createEntry = trpc.financial.createEntry.useMutation({
    onSuccess: () => {
      utils.financial.listCashbook.invalidate();
      setShowCreate(false);
      setForm(EMPTY_FORM);
    },
  });

  const entries = data?.entries ?? [];
  const balance = data?.balance;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Livro Caixa</h1>
          <p className="text-neutral-400 text-sm mt-0.5">Histórico de todas as entradas e saídas financeiras</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
        >
          <Plus size={15} />
          Lançamento Manual
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-600/15 rounded-lg"><TrendingUp size={16} className="text-emerald-400" /></div>
          <div>
            <p className="text-xs text-neutral-500">Entradas</p>
            <p className="text-base font-bold text-emerald-400">{balance ? formatBRL(balance.totalCredits) : '—'}</p>
          </div>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-rose-600/15 rounded-lg"><TrendingDown size={16} className="text-rose-400" /></div>
          <div>
            <p className="text-xs text-neutral-500">Saídas</p>
            <p className="text-base font-bold text-rose-400">{balance ? formatBRL(balance.totalDebits) : '—'}</p>
          </div>
        </div>
        <div className={`bg-neutral-900 border rounded-xl p-4 flex items-center gap-3 ${(balance?.netBalance ?? 0) >= 0 ? 'border-emerald-800/50' : 'border-rose-800/50'}`}>
          <div>
            <p className="text-xs text-neutral-500">Saldo Líquido</p>
            <p className={`text-lg font-bold ${(balance?.netBalance ?? 0) >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {balance ? formatBRL(balance.netBalance) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {([
          { value: undefined, label: 'Todos' },
          { value: 'credit', label: 'Entradas' },
          { value: 'debit', label: 'Saídas' },
        ] as const).map(f => (
          <button
            key={String(f.value)}
            onClick={() => setTypeFilter(f.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              typeFilter === f.value
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Entries Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500 uppercase tracking-wider border-b border-neutral-800">
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Descrição</th>
                <th className="text-left px-4 py-3">Categoria</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {isLoading ? (
                <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-violet-500" size={20} /></td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-neutral-500 text-sm">Nenhum lançamento ainda</td></tr>
              ) : entries.map(entry => (
                <tr key={entry.id} className="hover:bg-neutral-800/40 transition-colors">
                  <td className="px-4 py-3 text-neutral-400 whitespace-nowrap">{new Date(entry.referenceDate).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-white">{entry.description}</td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">{entry.category ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      entry.type === 'credit'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    }`}>
                      {entry.type === 'credit' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${entry.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {entry.type === 'debit' ? '- ' : '+ '}{formatBRL(entry.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Manual Entry Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-3">
            <h3 className="text-white font-semibold text-lg mb-1">Lançamento Manual</h3>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Tipo</label>
              <div className="flex gap-2">
                {(['credit', 'debit'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(p => ({ ...p, type: t }))}
                    className={`flex-1 text-sm py-2 rounded-lg border transition-colors ${
                      form.type === t
                        ? t === 'credit' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-600 text-white border-rose-600'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}
                  >
                    {t === 'credit' ? 'Entrada' : 'Saída'}
                  </button>
                ))}
              </div>
            </div>
            {(
              [
                { id: 'description', label: 'Descrição *', type: 'text', ph: 'Ex: Depósito bancário' },
                { id: 'amountCents', label: 'Valor (R$) *', type: 'number', ph: '0.00' },
                { id: 'referenceDate', label: 'Data *', type: 'date', ph: '' },
              ] as const
            ).map(f => (
              <div key={f.id}>
                <label className="text-xs text-neutral-400 mb-1 block">{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.ph}
                  value={(form as Record<string, string>)[f.id]}
                  onChange={e => setForm(prev => ({ ...prev, [f.id]: e.target.value }))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setShowCreate(false)} className="text-sm px-4 py-2 text-neutral-400 hover:text-white">Cancelar</button>
              <button
                disabled={!form.description || !form.amountCents || !form.referenceDate || createEntry.isPending}
                onClick={() => createEntry.mutate({
                  type: form.type,
                  amountCents: Math.round(parseFloat(form.amountCents) * 100),
                  description: form.description,
                  referenceDate: new Date(form.referenceDate).toISOString(),
                })}
                className="text-sm px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {createEntry.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
