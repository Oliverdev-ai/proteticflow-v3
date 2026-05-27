import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import {
  ArrowLeft,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  MapPin,
  Phone,
} from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendado', color: 'text-muted-foreground' },
  in_transit: { label: 'Em trânsito', color: 'text-[var(--info)]' },
  delivered: { label: 'Entregue', color: 'text-[var(--success)]' },
  failed: { label: 'Falhou', color: 'text-[var(--destructive)]' },
};

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [failedItemId, setFailedItemId] = useState<number | null>(null);
  const [failReason, setFailReason] = useState('');

  const { data, isLoading } = trpc.delivery.getSchedule.useQuery({ id: Number(id) });

  const updateStatus = trpc.delivery.updateItemStatus.useMutation({
    onSuccess: () => utils.delivery.getSchedule.invalidate(),
  });

  const markAllInTransit = trpc.delivery.markAllInTransit.useMutation({
    onSuccess: () => utils.delivery.getSchedule.invalidate(),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando roteiro...</div>;
  if (!data) return <div className="p-6 text-[var(--destructive)]">Roteiro não encontrado.</div>;

  const { schedule, items } = data;
  const allScheduled = items.every((i) => i.item.status === 'scheduled');
  const dateStr = new Date(schedule.date).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-white mb-6 text-sm transition-colors"
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      {/* Header */}
      <div className="bg-muted border border-border rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white capitalize">{dateStr}</h1>
            {schedule.driverName && (
              <p className="text-muted-foreground text-sm mt-1">
                Motorista: <span className="text-white">{schedule.driverName}</span>
              </p>
            )}
            {schedule.vehicle && (
              <p className="text-muted-foreground text-sm">
                Veículo: <span className="text-white">{schedule.vehicle}</span>
              </p>
            )}
          </div>
          {allScheduled && (
            <button
              onClick={() => markAllInTransit.mutate({ scheduleId: schedule.id })}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--info-soft)] hover:bg-[var(--info-soft)] text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Truck size={16} /> Iniciar Rota
            </button>
          )}
        </div>
        <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
          <span>
            <CheckCircle size={12} className="inline mr-1 text-[var(--success)]" />
            {items.filter((i) => i.item.status === 'delivered').length} entregues
          </span>
          <span>
            <XCircle size={12} className="inline mr-1 text-[var(--destructive)]" />
            {items.filter((i) => i.item.status === 'failed').length} falhas
          </span>
          <span>
            <Clock size={12} className="inline mr-1 text-muted-foreground" />
            {items.filter((i) => i.item.status === 'scheduled').length} pendentes
          </span>
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-3">
        {items.map((row, idx) => {
          const { item, clientName, clientAddress, clientPhone, clientNeighborhood, jobCode } = row;
          const statusCfg = STATUS_LABELS[item.status] ?? STATUS_LABELS.scheduled!;
          return (
            <div key={item.id} className="bg-muted border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-muted rounded-full flex items-center justify-center text-xs text-muted-foreground font-bold shrink-0">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-white font-medium">{clientName ?? '-'}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-normal text-muted-foreground">
                      {item.stopType === 'pickup' ? 'Coleta' : 'Entrega'}
                    </p>
                    {clientAddress && (
                      <p className="text-muted-foreground text-xs flex items-center gap-1 mt-0.5">
                        <MapPin size={11} /> {clientAddress}
                        {clientNeighborhood ? `, ${clientNeighborhood}` : ''}
                      </p>
                    )}
                    {clientPhone && (
                      <p className="text-muted-foreground text-xs flex items-center gap-1">
                        <Phone size={11} /> {clientPhone}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs mt-1">
                      {item.stopType === 'pickup' ? 'Parada sem OS vinculada' : `OS: ${jobCode ?? item.jobId}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-xs font-medium ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                  {(item.status === 'scheduled' || item.status === 'in_transit') && (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          updateStatus.mutate({ itemId: item.id, status: 'delivered' })
                        }
                        className="px-2 py-1 bg-[var(--success-soft)] text-[var(--success)] hover:bg-[var(--success-soft)] rounded text-xs transition-colors"
                      >
                        Entregue
                      </button>
                      <button
                        onClick={() => setFailedItemId(item.id)}
                        className="px-2 py-1 bg-[var(--destructive-soft)] text-[var(--destructive)] hover:bg-[var(--destructive-soft)] rounded text-xs transition-colors"
                      >
                        Falhou
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {item.failedReason && (
                <p className="text-[var(--destructive)] text-xs mt-2 flex items-center gap-1">
                  <AlertCircle size={12} /> {item.failedReason}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Failed reason modal */}
      {failedItemId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-muted border border-border rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-3">Motivo da falha</h3>
            <textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="Ex: Cliente ausente, endereço errado..."
              rows={3}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setFailedItemId(null);
                  setFailReason('');
                }}
                className="flex-1 px-4 py-2 border border-border text-muted-foreground rounded-lg text-sm hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!failReason.trim()) return;
                  updateStatus.mutate({
                    itemId: failedItemId,
                    status: 'failed',
                    failedReason: failReason,
                  });
                  setFailedItemId(null);
                  setFailReason('');
                }}
                className="flex-1 px-4 py-2 bg-[var(--destructive-soft)] hover:bg-[var(--destructive-soft)] text-white rounded-lg text-sm font-medium transition-colors"
              >
                Confirmar Falha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
