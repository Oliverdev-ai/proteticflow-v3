import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { ShoppingCart, ChevronLeft, CheckCircle, Clock, Send, XCircle, ArrowRight } from 'lucide-react';

const STATUS_CONFIG = {
  draft:      { label: 'Rascunho',  color: 'text-neutral-400', bg: 'bg-neutral-800', icon: Clock },
  sent:       { label: 'Enviada',   color: 'text-blue-400',    bg: 'bg-blue-900/20', icon: Send },
  received:   { label: 'Recebida',  color: 'text-green-400',   bg: 'bg-green-900/20', icon: CheckCircle },
  cancelled:  { label: 'Cancelada', color: 'text-red-400',     bg: 'bg-red-900/20', icon: XCircle },
};

export default function PurchaseOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const utils = trpc.useUtils();

  const { data } = trpc.inventory.listPOs.useQuery({
    status: (statusFilter || undefined) as 'draft' | 'sent' | 'received' | 'cancelled' | undefined,
    page: 1, limit: 50,
  });

  const changePOStatus = trpc.inventory.changePOStatus.useMutation({ onSuccess: () => utils.inventory.listPOs.invalidate() });

  const pos = data?.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/estoque" className="text-neutral-400 hover:text-white"><ChevronLeft size={20} /></Link>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><ShoppingCart size={22} className="text-violet-500" />Ordens de Compra</h1>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['', 'draft', 'sent', 'received', 'cancelled'] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${statusFilter === s ? 'bg-violet-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
          >
            {s === '' ? 'Todas' : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {pos.length === 0 && <p className="text-neutral-500 text-center py-10">Nenhuma ordem de compra encontrada</p>}
        {pos.map((po: typeof pos[number]) => {
          const cfg = STATUS_CONFIG[po.status as keyof typeof STATUS_CONFIG];
          const StatusIcon = cfg.icon;
          const totalBRL = (po.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          return (
            <div key={po.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{po.code}</span>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                      <StatusIcon size={11} /> {cfg.label}
                    </span>
                  </div>
                  <p className="text-neutral-500 text-xs mt-1">{new Date(po.createdAt).toLocaleDateString('pt-BR')}</p>
                  <p className="text-white font-semibold my-1">{totalBRL}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Link to={`/estoque/oc/${po.id}`} className="text-violet-400 hover:text-violet-300 text-xs flex items-center gap-1">
                    Ver detalhes <ArrowRight size={12} />
                  </Link>
                  {po.status === 'draft' && (
                    <button onClick={() => changePOStatus.mutate({ id: po.id, status: 'sent' })} className="px-2 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 rounded text-xs transition-colors">
                      Enviar OC
                    </button>
                  )}
                  {po.status === 'sent' && (
                    <button onClick={() => changePOStatus.mutate({ id: po.id, status: 'received' })} className="px-2 py-1 bg-green-600/20 text-green-400 hover:bg-green-600/40 rounded text-xs transition-colors">
                      ✓ Receber
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
