import { useParams, useNavigate } from 'react-router-dom';
import { trpc } from '../../../../lib/trpc';
import { ArrowLeft, CheckCircle, Send } from 'lucide-react';

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.inventory.getPO.useQuery({ id: Number(id) });
  const changePOStatus = trpc.inventory.changePOStatus.useMutation({
    onSuccess: () => utils.inventory.getPO.invalidate(),
  });

  if (isLoading) return <div className="p-6 text-zinc-400">Carregando OC...</div>;
  if (!data) return <div className="p-6 text-red-400">OC não encontrada.</div>;

  const { po, items } = data;
  const totalBRL = (po.totalCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const STATUS_MAP = {
    draft: 'Rascunho',
    sent: 'Enviada',
    received: 'Recebida',
    cancelled: 'Cancelada',
  };
  const STATUS_COLOR = {
    draft: 'text-zinc-400',
    sent: 'text-blue-400',
    received: 'text-green-400',
    cancelled: 'text-red-400',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 text-sm transition-colors"
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">{po.code}</h1>
              <span
                className={`text-sm font-medium ${STATUS_COLOR[po.status as keyof typeof STATUS_COLOR]}`}
              >
                · {STATUS_MAP[po.status as keyof typeof STATUS_MAP]}
              </span>
            </div>
            <p className="text-zinc-500 text-sm">
              Criada em {new Date(po.createdAt).toLocaleDateString('pt-BR')}
            </p>
            <p className="text-2xl font-bold text-primary mt-3">{totalBRL}</p>
            {po.notes && <p className="text-zinc-400 text-sm mt-2">{po.notes}</p>}
          </div>
          <div className="flex flex-col gap-2">
            {po.status === 'draft' && (
              <button
                onClick={() => changePOStatus.mutate({ id: po.id, status: 'sent' })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Send size={15} /> Enviar OC
              </button>
            )}
            {po.status === 'sent' && (
              <button
                onClick={() => changePOStatus.mutate({ id: po.id, status: 'received' })}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <CheckCircle size={15} /> Receber Todos
              </button>
            )}
            {(po.status === 'draft' || po.status === 'sent') && (
              <button
                onClick={() => changePOStatus.mutate({ id: po.id, status: 'cancelled' })}
                className="px-4 py-2 border border-red-800 text-red-400 hover:bg-red-900/20 rounded-lg text-sm transition-colors"
              >
                Cancelar OC
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <h2 className="text-lg font-semibold text-white mb-3">Itens da Ordem</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 text-zinc-400">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Material</th>
              <th className="text-right px-4 py-3 font-medium">Quantidade</th>
              <th className="text-right px-4 py-3 font-medium">Preço Unit.</th>
              <th className="text-right px-4 py-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {items.map(({ item, materialName }: (typeof items)[number]) => (
              <tr key={item.id} className="hover:bg-zinc-800/40">
                <td className="px-4 py-3 text-white">
                  {materialName ?? `Material #${item.materialId}`}
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">{Number(item.quantity)}</td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  {(item.unitPriceCents / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </td>
                <td className="px-4 py-3 text-right text-white font-medium">
                  {(item.totalCents / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-zinc-800 bg-zinc-800/30">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-white font-medium text-right">
                Total
              </td>
              <td className="px-4 py-3 text-right text-primary font-bold text-base">{totalBRL}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
