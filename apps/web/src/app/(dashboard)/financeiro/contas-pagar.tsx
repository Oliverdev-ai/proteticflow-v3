import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { Plus, CheckCircle, XCircle, Loader2 } from 'lucide-react';

type ApStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

const STATUS_MAP: Record<ApStatus, { label: string; cls: string }> = {
  pending:   { label: 'Pendente',  cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  paid:      { label: 'Pago',      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  overdue:   { label: 'Vencido',   cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  cancelled: { label: 'Cancelado', cls: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30' },
};

function StatusBadge({ status }: { status: ApStatus }) {
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

const EMPTY_FORM = { description: '', amountCents: '', dueDate: '', supplier: '', notes: '' };

export default function ContasPagarPage() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<ApStatus | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const { data, isLoading } = trpc.financial.listAp.useQuery({ status: statusFilter, limit: 50 });

  const createAp = trpc.financial.createAp.useMutation({
    onSuccess: () => {
      utils.financial.listAp.invalidate();
      setShowCreate(false);
      setForm(EMPTY_FORM);
    },
  });

  const markPaid = trpc.financial.markApPaid.useMutation({
    onSuccess: () => utils.financial.listAp.invalidate(),
  });

  const cancelAp = trpc.financial.cancelAp.useMutation({
    onSuccess: () => {
      utils.financial.listAp.invalidate();
      setCancelId(null);
      setCancelReason('');
    },
  });

  const statuses: Array<{ value: ApStatus | undefined; label: string }> = [
    { value: undefined, label: 'Todos' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'overdue', label: 'Vencidos' },
    { value: 'paid', label: 'Pagos' },
    { value: 'cancelled', label: 'Cancelados' },
  ];

  const rows = data?.data ?? [];

  const handleCreate = () => {
    if (!form.description || !form.amountCents || !form.dueDate) return;
    createAp.mutate({
      description: form.description,
      amountCents: Math.round(parseFloat(form.amountCents) * 100),
      dueDate: new Date(form.dueDate).toISOString(),
      supplier: form.supplier || undefined,
      notes: form.notes || undefined,
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Contas a Pagar</h1>
          <p className="text-neutral-400 text-sm mt-0.5">Despesas e obrigações financeiras do laboratório</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
        >
          <Plus size={15} />
          Nova Conta
        </button>
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
                <th className="text-left px-4 py-3">Descrição</th>
                <th className="text-left px-4 py-3">Fornecedor</th>
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
              ) : rows.map(ap => (
                <tr key={ap.id} className="hover:bg-neutral-800/40 transition-colors">
                  <td className="px-4 py-3 text-white">{ap.description}</td>
                  <td className="px-4 py-3 text-neutral-400">{ap.supplier ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-rose-400">{formatBRL(ap.amountCents)}</td>
                  <td className="px-4 py-3 text-neutral-300">{new Date(ap.dueDate).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3"><StatusBadge status={ap.status as ApStatus} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {(ap.status === 'pending' || ap.status === 'overdue') && (
                        <>
                          <button
                            onClick={() => markPaid.mutate({ id: ap.id, paymentMethod: 'Boleto' })}
                            disabled={markPaid.isPending}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <CheckCircle size={13} />
                            Pago
                          </button>
                          <button
                            onClick={() => setCancelId(ap.id)}
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

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-3">
            <h3 className="text-white font-semibold text-lg mb-1">Nova Conta a Pagar</h3>
            {(
              [
                { id: 'description', label: 'Descrição *', type: 'text', ph: 'Ex: Conta de luz' },
                { id: 'supplier', label: 'Fornecedor', type: 'text', ph: 'Ex: CEMIG' },
                { id: 'amountCents', label: 'Valor (R$) *', type: 'number', ph: '0.00' },
                { id: 'dueDate', label: 'Vencimento *', type: 'date', ph: '' },
                { id: 'notes', label: 'Observações', type: 'text', ph: '' },
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
            <div className="flex gap-3 mt-2 justify-end pt-1">
              <button onClick={() => setShowCreate(false)} className="text-sm px-4 py-2 text-neutral-400 hover:text-white transition-colors">Cancelar</button>
              <button
                onClick={handleCreate}
                disabled={createAp.isPending}
                className="text-sm px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {createAp.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelId !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-4">Cancelar Conta a Pagar</h3>
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
                disabled={!cancelReason.trim() || cancelAp.isPending}
                onClick={() => cancelAp.mutate({ id: cancelId, cancelReason })}
                className="text-sm px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {cancelAp.isPending ? 'Cancelando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
