import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { 
  Plus, XCircle, Loader2, ChevronLeft,
  Calendar, Building2, Receipt, FileText, CheckCircle2,
  X, AlertCircle, Ban, Landmark, ShoppingBag
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatBRL } from '../../../lib/format';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted, Large } from '../../../components/shared/typography';
import { EmptyState } from '../../../components/shared/empty-state';
import { cn } from '../../../lib/utils';

type ApStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

const STATUS_MAP: Record<ApStatus, { label: string; cls: string; icon: LucideIcon }> = {
  pending:   { label: 'Pendente',  cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: AlertCircle },
  paid:      { label: 'Pago',      cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
  overdue:   { label: 'Vencido',   cls: 'bg-destructive/10 text-destructive border-destructive/20', icon: Ban },
  cancelled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

function StatusBadge({ status }: { status: ApStatus }) {
  const { label, cls, icon: Icon } = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[9px] px-3 py-1 rounded-full border font-black uppercase tracking-widest", cls)}>
      <Icon size={12} strokeWidth={3} />
      {label}
    </span>
  );
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

  const inputClass = "w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-semibold placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all";
  const labelClass = "block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1";

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
            <H1 className="tracking-tight">Contas a Pagar</H1>
            <Subtitle>Gestão de obrigações, despesas fixas e variáveis</Subtitle>
          </div>
        </div>

        <button 
          onClick={() => setShowCreate(true)} 
          className="flex items-center gap-3 px-6 py-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95"
        >
          <Plus size={16} strokeWidth={3} /> Registrar Despesa
        </button>
      </div>

      {/* Filters & Navigation */}
      <div className="flex flex-wrap items-center gap-3 bg-card/30 backdrop-blur-sm p-2 rounded-[24px] border border-border w-fit">
        {statuses.map(s => (
          <button
            key={String(s.value)}
            onClick={() => setStatusFilter(s.value)}
            className={cn(
              "text-[10px] px-6 py-3 rounded-2xl font-black uppercase tracking-widest transition-all duration-300 active:scale-95",
              statusFilter === s.value
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'bg-transparent text-muted-foreground hover:bg-muted'
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
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4 truncate">Descrição da Conta</th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Favorecido / Fornecedor</th>
                  <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Valor Nominal</th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Vencimento</th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-24 text-center">
                       <div className="flex flex-col items-center gap-4">
                          <Loader2 className="animate-spin text-primary/40" size={48} />
                          <Muted className="animate-pulse font-black uppercase tracking-[0.2em]">Sincronizando contas do passivo...</Muted>
                       </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-0">
                       <div className="p-20">
                         <EmptyState 
                          icon={Landmark} 
                          title="Sem compromissos em aberto" 
                          description="Suas despesas e obrigações operacionais agendadas aparecerão aqui." 
                         />
                       </div>
                    </td>
                  </tr>
                ) : rows.map(ap => (
                  <tr key={ap.id} className="group hover:bg-primary/[0.02] transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">Doc #{ap.id}</span>
                        <div className="flex items-center gap-2">
                           <FileText size={14} className="text-destructive/40" />
                           <span className="text-sm font-black text-foreground tracking-tight">{ap.description}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-black text-[10px] border border-border shadow-inner">
                             <Building2 size={14} className="opacity-40" />
                          </div>
                          <span className="text-xs font-bold text-muted-foreground tracking-wider uppercase">{ap.supplier ?? 'Sem Fornecedor'}</span>
                       </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <Large className="text-destructive font-black tracking-tighter text-lg leading-none">
                         {formatBRL(ap.amountCents)}
                       </Large>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                          <Calendar size={14} className="opacity-40" />
                          {new Date(ap.dueDate).toLocaleDateString('pt-BR')}
                       </div>
                    </td>
                    <td className="px-6 py-5">
                       <StatusBadge status={ap.status as ApStatus} />
                    </td>
                    <td className="px-6 py-5 text-right">
                       <div className="flex items-center justify-end gap-2 group-hover:translate-x-0 translate-x-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          {(ap.status === 'pending' || ap.status === 'overdue') && (
                            <>
                              <button
                                onClick={() => markPaid.mutate({ id: ap.id, paymentMethod: 'Transferência' })}
                                disabled={markPaid.isPending}
                                className="h-10 flex items-center gap-2 px-4 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                              >
                                <CheckCircle2 size={14} strokeWidth={3} /> Quitar
                              </button>
                              <button
                                onClick={() => setCancelId(ap.id)}
                                className="h-10 w-10 flex items-center justify-center bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border border-destructive/20 rounded-xl transition-all active:scale-95 shadow-sm"
                                title="Anular despesa"
                              >
                                <Ban size={16} strokeWidth={3} />
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
      </ScaleIn>

      {/* Premium Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
          <ScaleIn className="w-full max-w-xl">
            <div className="premium-card p-10 flex flex-col gap-10 relative shadow-2xl border-primary/20 overflow-hidden">
               {/* Accent decoration */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10" />
               
               <div className="flex justify-between items-start relative">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                      <Plus size={24} strokeWidth={3} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <H1 className="text-2xl tracking-tighter">Nova Conta a Pagar</H1>
                      <Muted className="text-[10px] font-black uppercase tracking-[0.2em]">Registrar compromisso financeiro</Muted>
                    </div>
                 </div>
                 <button 
                  onClick={() => setShowCreate(false)} 
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-all active:scale-90"
                 >
                   <X size={20} strokeWidth={3} />
                 </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Descrição da Despesa *</label>
                    <div className="relative">
                       <input 
                         value={form.description} 
                         onChange={e => setForm(f => ({ ...f, description: e.target.value }))} 
                         placeholder="Ex: Aluguel do laboratório, Conta de Luz..."
                         className={inputClass} 
                       />
                       <Receipt className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50" size={18} />
                    </div>
                 </div>

                 <div>
                    <label className={labelClass}>Favorecido / Fornecedor</label>
                    <div className="relative">
                       <input 
                         value={form.supplier} 
                         onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} 
                         placeholder="Ex: Imobiliária Silva"
                         className={inputClass} 
                       />
                       <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50" size={18} />
                    </div>
                 </div>

                 <div>
                    <label className={labelClass}>Valor (R$) *</label>
                    <div className="relative">
                       <input 
                         type="number"
                         step="0.01"
                         value={form.amountCents} 
                         onChange={e => setForm(f => ({ ...f, amountCents: e.target.value }))} 
                         placeholder="0.00"
                         className={cn(inputClass, "font-mono font-bold text-lg text-destructive")} 
                       />
                       <Landmark className="absolute right-4 top-1/2 -translate-y-1/2 text-destructive opacity-50" size={18} />
                    </div>
                 </div>

                 <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className={labelClass}>Vencimento *</label>
                      <div className="relative">
                        <input 
                          type="date"
                          value={form.dueDate} 
                          onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} 
                          className={inputClass} 
                        />
                        <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50" size={18} />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Notas Adicionais</label>
                      <div className="relative">
                        <input 
                          value={form.notes} 
                          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} 
                          placeholder="Doc #12345"
                          className={inputClass} 
                        />
                        <ShoppingBag className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50" size={18} />
                      </div>
                    </div>
                 </div>
               </div>

               <div className="flex gap-4 pt-6 mt-4 border-t border-border/50 relative">
                  <button 
                    onClick={() => setShowCreate(false)} 
                    className="flex-1 py-5 rounded-2xl bg-muted border border-border text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all active:scale-95"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!form.description.trim() || !form.amountCents || !form.dueDate || createAp.isPending}
                    className="flex-[1.5] py-5 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
                  >
                    {createAp.isPending ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} strokeWidth={3} /> Salvar Lançamento</>}
                  </button>
               </div>
            </div>
          </ScaleIn>
        </div>
      )}

      {/* Cancel Modal (Consistent with Ar) */}
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
                      <H1 className="text-2xl tracking-tighter">Anular Despesa</H1>
                      <Muted className="text-[10px] font-black uppercase tracking-[0.2em]">Exclusão de compromisso financeiro</Muted>
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
                    "Esta conta a pagar será marcada como cancelada. O compromisso será retirado dos fluxos de faturamento mas permanecerá no log para auditoria reversa."
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Justificativa do Cancelamento *</label>
                    <textarea
                      value={cancelReason}
                      onChange={e => setCancelReason(e.target.value)}
                      placeholder="Descreva o motivo da anulação..."
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
                    disabled={!cancelReason.trim() || cancelAp.isPending}
                    onClick={() => cancelAp.mutate({ id: cancelId, cancelReason })}
                    className="flex-[1.5] py-5 rounded-2xl bg-destructive text-destructive-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-destructive/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                  >
                    {cancelAp.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar Anulação'}
                  </button>
               </div>
            </div>
          </ScaleIn>
        </div>
      )}
    </PageTransition>
  );
}
