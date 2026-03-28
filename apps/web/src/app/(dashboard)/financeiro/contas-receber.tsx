import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

type ArStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

const STATUS_MAP: Record<ArStatus, { label: string; cls: string }> = {
  pending:   { label: 'Pendente',  cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  paid:      { label: 'Pago',      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  overdue:   { label: 'Vencido',   cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  cancelled: { label: 'Cancelado', cls: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30' },
};

function StatusBadge({ status }: { status: ArStatus }) {
  const { label, cls } = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {label}
    </span>
  );
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ContasReceberPage() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<ArStatus | undefined>(undefined);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const { data, isLoading } = trpc.financial.listAr.useQuery({
    status: statusFilter,
    limit: 50,
  });

  const markPaid = trpc.financial.markArPaid.useMutation({
    onSuccess: () => utils.financial.listAr.invalidate(),
  });

  const cancelAr = trpc.financial.cancelAr.useMutation({
    onSuccess: () => {
      utils.financial.listAr.invalidate();
      setCancelId(null);
      setCancelReason('');
    },
  });

  const statuses: Array<{ value: ArStatus | undefined; label: string }> = [
    { value: undefined, label: 'Todos' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'overdue', label: 'Vencidos' },
    { value: 'paid', label: 'Pagos' },
    { value: 'cancelled', label: 'Cancelados' },
  ];

  const rows = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Contas a Receber</h1>
          <p className="text-neutral-400 text-sm mt-0.5">Faturas geradas a partir das Ordens de Serviço</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map(s => (
          <button
            key={String(s.value)}
            onClick={() => setStatusFilter(s.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              statusFilter === s.value
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500 uppercase tracking-wider border-b border-neutral-800">
                <th className="text-left px-4 py-3">#</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-left px-4 py-3">Vencimento</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {isLoading ? (
                <tr><td colSpan={6} className="py-10 text-center">
                  <Loader2 className="animate-spin mx-auto text-violet-500" size={20} />
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-neutral-500 text-sm">Nenhuma conta encontrada</td></tr>
              ) : rows.map(({ ar, clientName }) => (
                <tr key={ar.id} className="hover:bg-neutral-800/40 transition-colors">
                  <td className="px-4 py-3 text-neutral-400 font-mono text-xs">OS#{ar.jobId}</td>
                  <td className="px-4 py-3 text-white">{clientName ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-400">{formatBRL(ar.amountCents)}</td>
                  <td className="px-4 py-3 text-neutral-300">{new Date(ar.dueDate).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3"><StatusBadge status={ar.status as ArStatus} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {(ar.status === 'pending' || ar.status === 'overdue') && (
                        <>
                          <button
                            onClick={() => markPaid.mutate({ id: ar.id, paymentMethod: 'PIX' })}
                            disabled={markPaid.isPending}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <CheckCircle size={13} />
                            Recebido
                          </button>
                          <button
                            onClick={() => setCancelId(ar.id)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 rounded-lg transition-colors"
                          >
                            <XCircle size={13} />
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancel modal */}
      {cancelId !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-4">Cancelar Conta a Receber</h3>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Motivo obrigatório..."
              rows={3}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-violet-500 resize-none"
            />
            <div className="flex gap-3 mt-4 justify-end">
              <button onClick={() => setCancelId(null)} className="text-sm px-4 py-2 text-neutral-400 hover:text-white transition-colors">Voltar</button>
              <button
                disabled={!cancelReason.trim() || cancelAr.isPending}
                onClick={() => cancelAr.mutate({ id: cancelId, cancelReason })}
                className="text-sm px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {cancelAr.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
