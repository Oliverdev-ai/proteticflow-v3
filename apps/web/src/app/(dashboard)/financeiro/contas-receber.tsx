import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import {
  XCircle,
  Loader2,
  ChevronLeft,
  ArrowRight,
  Calendar,
  Receipt,
  Hash,
  CheckCircle2,
  X,
  AlertCircle,
  Ban,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatBRL } from '../../../lib/format';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted, Large } from '../../../components/shared/typography';
import { EmptyState } from '../../../components/shared/empty-state';
import { cn } from '../../../lib/utils';

type ArStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

const STATUS_MAP: Record<ArStatus, { label: string; cls: string; icon: LucideIcon }> = {
  pending: {
    label: 'Pendente',
    cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    icon: AlertCircle,
  },
  paid: {
    label: 'Pago',
    cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    icon: CheckCircle2,
  },
  overdue: {
    label: 'Vencido',
    cls: 'bg-destructive/10 text-destructive border-destructive/20',
    icon: Ban,
  },
  cancelled: {
    label: 'Cancelado',
    cls: 'bg-muted text-muted-foreground border-border',
    icon: XCircle,
  },
};

function StatusBadge({ status }: { status: ArStatus }) {
  const { label, cls, icon: Icon } = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[9px] px-3 py-1 rounded-full border font-black uppercase tracking-widest',
        cls,
      )}
    >
      <Icon size={12} strokeWidth={3} />
      {label}
    </span>
  );
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
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-6xl mx-auto pb-12">
      {/* Header Area */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link
            to="/financeiro"
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all active:scale-95 shadow-sm"
          >
            <ChevronLeft size={20} strokeWidth={3} />
          </Link>
          <div className="flex flex-col gap-0.5">
            <H1 className="tracking-tight">Contas a Receber</H1>
            <Subtitle>Conciliação de faturas e monitoramento de OS faturadas</Subtitle>
          </div>
        </div>
      </div>

      {/* Filters & Navigation */}
      <div className="flex flex-wrap items-center gap-3 bg-card/30 backdrop-blur-sm p-2 rounded-[24px] border border-border w-fit">
        {statuses.map((s) => (
          <button
            key={String(s.value)}
            onClick={() => setStatusFilter(s.value)}
            className={cn(
              'text-[10px] px-6 py-3 rounded-2xl font-black uppercase tracking-widest transition-all duration-300 active:scale-95',
              statusFilter === s.value
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'bg-transparent text-muted-foreground hover:bg-muted',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table Area */}
      <ScaleIn>
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4 truncate">
                    # Ref / OS
                  </th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">
                    Devedor (Cliente)
                  </th>
                  <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">
                    Valor Bruto
                  </th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">
                    Vencimento
                  </th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">
                    Status Atual
                  </th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-primary/40" size={48} />
                        <Muted className="animate-pulse font-black uppercase tracking-[0.2em]">
                          Consultando livro registro...
                        </Muted>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <div className="p-20">
                        <EmptyState
                          icon={Receipt}
                          title="Sem lançamentos encontrados"
                          description="As faturas aparecerão aqui conforme as ordens de serviço forem faturadas ou liquidadas."
                        />
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map(({ ar, clientName }) => (
                    <tr key={ar.id} className="group hover:bg-primary/[0.02] transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">
                            Título F89-{ar.id}
                          </span>
                          <div className="flex items-center gap-2">
                            <Hash size={14} className="text-primary/40" />
                            <span className="text-xs font-black text-foreground">
                              OS#{ar.jobId}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-black text-[10px] border border-border shadow-inner">
                            {clientName?.substring(0, 2).toUpperCase() || '??'}
                          </div>
                          <span className="text-sm font-black text-foreground tracking-tight">
                            {clientName ?? 'Não Identificado'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <Large className="text-emerald-500 font-black tracking-tighter text-lg leading-none">
                          {formatBRL(ar.amountCents)}
                        </Large>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                          <Calendar size={14} className="opacity-40" />
                          {new Date(ar.dueDate).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <StatusBadge status={ar.status as ArStatus} />
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 group-hover:translate-x-0 translate-x-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          {(ar.status === 'pending' || ar.status === 'overdue') && (
                            <>
                              <button
                                onClick={() => markPaid.mutate({ id: ar.id, paymentMethod: 'PIX' })}
                                disabled={markPaid.isPending}
                                className="h-10 flex items-center gap-2 px-4 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                              >
                                <CheckCircle2 size={14} strokeWidth={3} /> Liquidar
                              </button>
                              <button
                                onClick={() => setCancelId(ar.id)}
                                className="h-10 w-10 flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border border-destructive/20 rounded-xl transition-all active:scale-95 shadow-sm"
                                title="Cancelar título"
                              >
                                <Ban size={16} strokeWidth={3} />
                              </button>
                            </>
                          )}
                          <Link
                            to={`/trabalhos/${ar.jobId}`}
                            className="h-10 w-10 flex items-center justify-center bg-muted text-muted-foreground hover:text-primary hover:border-primary/50 border border-border rounded-xl transition-all active:scale-95"
                            title="Ver OS original"
                          >
                            <ArrowRight size={16} strokeWidth={3} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </ScaleIn>

      {/* Cancel Modal with Premium Styling */}
      {cancelId !== null && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
          <ScaleIn className="w-full max-w-xl">
            <div className="premium-card p-10 flex flex-col gap-10 relative shadow-2xl border-destructive/20 overflow-hidden">
              {/* Accent decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/5 rounded-full blur-3xl -mr-10 -mt-10" />

              <div className="flex justify-between items-start relative">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive shadow-inner">
                    <Ban size={24} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <H1 className="text-2xl tracking-tighter">Cancelar Fatura</H1>
                    <Muted className="text-[10px] font-black uppercase tracking-[0.2em]">
                      Estorno ou exclusão de título financeiro
                    </Muted>
                  </div>
                </div>
                <button
                  onClick={() => setCancelId(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-all active:scale-90"
                >
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              <div className="flex flex-col gap-4 relative">
                <div className="p-4 bg-muted/50 rounded-2xl border border-border text-xs text-muted-foreground leading-relaxed italic">
                  "Esta conta a receber será marcada como cancelada. O valor não será contabilizado
                  nos fluxos de caixa e o título continuará no histórico para auditoria."
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                    Motivo do Estorno *
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Ex: OS cancelada pelo cliente, erro de faturamento..."
                    rows={4}
                    className="w-full bg-muted border border-border rounded-2xl px-6 py-5 text-sm font-semibold text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:border-destructive/40 transition-all resize-none shadow-inner"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-border/50 relative">
                <button
                  onClick={() => setCancelId(null)}
                  className="flex-1 py-5 rounded-2xl bg-muted border border-border text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-all active:scale-95"
                >
                  Voltar
                </button>
                <button
                  disabled={!cancelReason.trim() || cancelAr.isPending}
                  onClick={() => cancelAr.mutate({ id: cancelId, cancelReason })}
                  className="flex-[1.5] py-5 rounded-2xl bg-destructive text-destructive-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-destructive/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {cancelAr.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Confirmar Cancelamento'
                  )}
                </button>
              </div>
            </div>
          </ScaleIn>
        </div>
      )}
    </PageTransition>
  );
}
