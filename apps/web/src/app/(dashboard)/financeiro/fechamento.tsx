import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { Plus, FileText, Loader2 } from 'lucide-react';

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const STATUS_CLS: Record<string, string> = {
  open:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  closed: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  paid:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};
const STATUS_LABEL: Record<string, string> = { open: 'Aberto', closed: 'Fechado', paid: 'Liquidado' };

export default function FechamentoPage() {
  const utils = trpc.useUtils();
  const [showModal, setShowModal] = useState(false);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data, isLoading } = trpc.financial.listClosings.useQuery({ page: 1, limit: 30 });

  const generate = trpc.financial.generateClosing.useMutation({
    onSuccess: () => {
      utils.financial.listClosings.invalidate();
      setShowModal(false);
    },
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Fechamentos Mensais</h1>
          <p className="text-neutral-400 text-sm mt-0.5">Balanço mensal de faturamento e recebimentos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
        >
          <Plus size={15} />
          Gerar Fechamento
        </button>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500 uppercase tracking-wider border-b border-neutral-800">
                <th className="text-left px-4 py-3">Período</th>
                <th className="text-right px-4 py-3">Total OS</th>
                <th className="text-right px-4 py-3">Faturado</th>
                <th className="text-right px-4 py-3">Recebido</th>
                <th className="text-right px-4 py-3">Pendente</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {isLoading ? (
                <tr><td colSpan={6} className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-violet-500" size={20} /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-neutral-500 text-sm">Nenhum fechamento gerado</td></tr>
              ) : rows.map(c => (
                <tr key={c.id} className="hover:bg-neutral-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-violet-300 font-medium">{c.period}</td>
                  <td className="px-4 py-3 text-right text-neutral-300">{c.totalJobs}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold">{formatBRL(c.totalAmountCents)}</td>
                  <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{formatBRL(c.paidAmountCents)}</td>
                  <td className="px-4 py-3 text-right text-amber-400">{formatBRL(c.pendingAmountCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_CLS[c.status] ?? ''}`}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-600/20 rounded-lg"><FileText size={18} className="text-violet-400" /></div>
              <h3 className="text-white font-semibold text-lg">Gerar Fechamento</h3>
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Período (AAAA-MM)</label>
              <input
                type="month"
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button onClick={() => setShowModal(false)} className="text-sm px-4 py-2 text-neutral-400 hover:text-white">Cancelar</button>
              <button
                onClick={() => generate.mutate({ period })}
                disabled={generate.isPending}
                className="text-sm px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {generate.isPending ? 'Gerando...' : 'Gerar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
