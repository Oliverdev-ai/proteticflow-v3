import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import {
  Plus,
  FileText,
  Loader2,
  ChevronLeft,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Activity,
  FileCheck,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatBRL } from '../../../lib/format';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted } from '../../../components/shared/typography';
import { EmptyState } from '../../../components/shared/empty-state';
import { cn } from '../../../lib/utils';

const STATUS_MAP: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
  open: {
    label: 'Aberto',
    cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    icon: AlertCircle,
  },
  closed: {
    label: 'Fechado',
    cls: 'bg-primary/10 text-primary border-primary/20',
    icon: FileCheck,
  },
  paid: {
    label: 'Liquidado',
    cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    icon: CheckCircle2,
  },
};

function StatusBadge({ status }: { status: string }) {
  const {
    label,
    cls,
    icon: Icon,
  } = STATUS_MAP[status] ?? {
    label: status,
    cls: 'bg-muted text-muted-foreground',
    icon: FileText,
  };
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
            <H1 className="tracking-tight">Fechamentos Mensais</H1>
            <Subtitle>Apuração consolidada de receitas e performance operacional</Subtitle>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-3 px-6 py-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95"
        >
          <Plus size={16} strokeWidth={3} /> Gerar Fechamento
        </button>
      </div>

      {/* Table Area */}
      <ScaleIn>
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                    Período Fiscal
                  </th>
                  <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                    Volatilidade (OS)
                  </th>
                  <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                    Faturamento Bruto
                  </th>
                  <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                    Liquidez (Pago)
                  </th>
                  <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                    Inadimplência (AR)
                  </th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-primary/30" size={48} />
                        <Muted className="animate-pulse font-black uppercase tracking-[0.2em]">
                          Consolidando faturas mensais...
                        </Muted>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <div className="p-20">
                        <EmptyState
                          icon={DollarSign}
                          title="Nenhum balanço gerado"
                          description="Clique em 'Gerar Fechamento' para processar o faturamento de um período específico."
                        />
                      </div>
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.id} className="group hover:bg-primary/[0.01] transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/10 font-black text-[10px] shadow-inner">
                            {c.period.split('-')[1]}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-black text-foreground uppercase tracking-tight">
                              {c.period}
                            </span>
                            <Muted className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                              Competência
                            </Muted>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-black text-foreground tabular-nums">
                            {c.totalJobs}
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                            Trabalhos OS
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-black text-foreground tabular-nums tracking-tighter">
                            {formatBRL(c.totalAmountCents)}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex flex-col items-end gap-0.5 text-emerald-500">
                          <span className="text-sm font-black tabular-nums tracking-tighter">
                            {formatBRL(c.paidAmountCents)}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex flex-col items-end gap-0.5 text-amber-500">
                          <span className="text-sm font-black tabular-nums tracking-tighter">
                            {formatBRL(c.pendingAmountCents)}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <StatusBadge status={c.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </ScaleIn>

      {/* Generate Fechamento Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
          <ScaleIn className="w-full max-w-lg">
            <div className="premium-card p-10 flex flex-col gap-10 relative shadow-2xl border-primary/20 overflow-hidden">
              {/* Accent decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10" />

              <div className="flex justify-between items-start relative">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <FileText size={24} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <H1 className="text-2xl tracking-tighter">Gerar Fechamento</H1>
                    <Muted className="text-[10px] font-black uppercase tracking-[0.2em]">
                      Processamento de faturamento consolidado
                    </Muted>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-all active:scale-90"
                >
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              <div className="flex flex-col gap-6 relative">
                <div className="p-5 bg-muted/50 rounded-2xl border border-border text-xs text-muted-foreground leading-relaxed">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Activity size={14} strokeWidth={3} />
                    <span className="font-black uppercase tracking-widest text-[9px]">
                      Automação Inteligente
                    </span>
                  </div>
                  Ao gerar o fechamento, o sistema irá recalcular todos os títulos em aberto (AR) do
                  mês selecionado e consolidar o faturamento total. Este processo é reversível ao
                  gerar novamente para o mesmo mês.
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">
                    Mês de Referência *
                  </label>
                  <div className="relative">
                    <input
                      type="month"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="w-full bg-muted border border-border rounded-2xl px-6 py-5 text-sm font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-inner uppercase tracking-tighter"
                    />
                    <Calendar
                      className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50"
                      size={20}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-border/50 relative">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-5 rounded-2xl bg-muted border border-border text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-all active:scale-95"
                >
                  Descartar
                </button>
                <button
                  onClick={() => generate.mutate({ period })}
                  disabled={generate.isPending}
                  className="flex-[1.5] py-5 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {generate.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <TrendingUp size={16} strokeWidth={3} /> Processar Balanço
                    </>
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
