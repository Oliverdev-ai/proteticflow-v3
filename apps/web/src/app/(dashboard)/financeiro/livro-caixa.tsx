import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Loader2,
  ChevronLeft,
  Calendar,
  BookOpen,
  Activity,
  Tag,
  CheckCircle2,
  X,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  Receipt,
  FileText,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { parseBRL } from '@proteticflow/shared';
import { formatBRL } from '../../../lib/format';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted, Large } from '../../../components/shared/typography';
import { EmptyState } from '../../../components/shared/empty-state';
import { cn } from '../../../lib/utils';

function createEmptyForm() {
  return {
    type: 'credit' as 'credit' | 'debit',
    amountCents: '',
    description: '',
    referenceDate: new Date().toISOString().slice(0, 10),
  };
}

const EMPTY_FORM = createEmptyForm();

export default function LivroCaixaPage() {
  const utils = trpc.useUtils();
  const [typeFilter, setTypeFilter] = useState<'credit' | 'debit' | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(createEmptyForm());

  const { data, isLoading } = trpc.financial.listCashbook.useQuery({
    type: typeFilter,
    page: 1,
    limit: 100,
  });

  const createEntry = trpc.financial.createEntry.useMutation({
    onSuccess: () => {
      utils.financial.listCashbook.invalidate();
      setShowCreate(false);
      setForm(createEmptyForm());
    },
  });

  const entries = data?.entries ?? [];
  const balance = data?.balance;

  const inputClass =
    'w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-semibold placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-inner';
  const labelClass =
    'block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1';

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
            <H1 className="tracking-tight">Livro Caixa</H1>
            <Subtitle>Registro histórico e detalhado de todas as transações efetivadas</Subtitle>
          </div>
        </div>

        <button
          onClick={() => {
            setForm(createEmptyForm());
            setShowCreate(true);
          }}
          className="flex items-center gap-3 px-6 py-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95"
        >
          <Plus size={16} strokeWidth={3} /> Lançamento Avulso
        </button>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ScaleIn className="premium-card p-6 flex flex-col gap-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-3xl -mr-8 -mt-8" />
          <div className="flex items-center justify-between relative">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 shadow-inner border border-emerald-500/10">
              <TrendingUp size={20} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60">
              Total Créditos
            </span>
          </div>
          <div className="flex flex-col gap-0.5 relative">
            <Large className="text-3xl font-black tracking-tighter text-emerald-500 tabular-nums">
              {balance ? formatBRL(balance.totalCredits) : '—'}
            </Large>
            <Muted className="text-[9px] font-bold uppercase tracking-widest">
              Entradas acumuladas
            </Muted>
          </div>
        </ScaleIn>

        <ScaleIn
          delay={0.1}
          className="premium-card p-6 flex flex-col gap-6 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-destructive/5 rounded-full blur-3xl -mr-8 -mt-8" />
          <div className="flex items-center justify-between relative">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-destructive/10 text-destructive shadow-inner border border-destructive/10">
              <TrendingDown size={20} strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-destructive/60">
              Total Débitos
            </span>
          </div>
          <div className="flex flex-col gap-0.5 relative">
            <Large className="text-3xl font-black tracking-tighter text-destructive tabular-nums">
              {balance ? formatBRL(balance.totalDebits) : '—'}
            </Large>
            <Muted className="text-[9px] font-bold uppercase tracking-widest">
              Saídas acumuladas
            </Muted>
          </div>
        </ScaleIn>

        <ScaleIn
          delay={0.2}
          className={cn(
            'premium-card p-6 flex flex-col gap-6 relative overflow-hidden',
            (balance?.netBalance ?? 0) >= 0
              ? 'bg-emerald-500/[0.03] border-emerald-500/20 shadow-emerald-500/5 shadow-2xl'
              : 'bg-destructive/[0.03] border-destructive/20 shadow-destructive/5 shadow-2xl',
          )}
        >
          <div className="flex items-center justify-between relative">
            <div
              className={cn(
                'w-12 h-12 flex items-center justify-center rounded-[20px] shadow-lg transition-transform duration-500 hover:rotate-12',
                (balance?.netBalance ?? 0) >= 0
                  ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                  : 'bg-destructive text-white shadow-destructive/20',
              )}
            >
              <Activity size={24} strokeWidth={2.5} />
            </div>
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest',
                (balance?.netBalance ?? 0) >= 0
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : 'bg-destructive/10 text-destructive border-destructive/20',
              )}
            >
              {(balance?.netBalance ?? 0) >= 0 ? (
                <ArrowUpRight size={10} strokeWidth={3} />
              ) : (
                <ArrowDownRight size={10} strokeWidth={3} />
              )}
              Saldo Real
            </div>
          </div>
          <div className="flex flex-col gap-0.5 relative">
            <Large
              className={cn(
                'text-3xl font-black tracking-tighter tabular-nums',
                (balance?.netBalance ?? 0) >= 0 ? 'text-emerald-500' : 'text-destructive',
              )}
            >
              {balance ? formatBRL(balance.netBalance) : '—'}
            </Large>
            <Muted className="text-[9px] font-black uppercase tracking-widest opacity-60">
              Disponibilidade líquida
            </Muted>
          </div>
        </ScaleIn>
      </div>

      {/* Filters Area */}
      <div className="flex flex-wrap items-center gap-3 bg-card/30 backdrop-blur-sm p-2 rounded-[24px] border border-border w-fit">
        {(
          [
            { value: undefined, label: 'Todos' },
            { value: 'credit', label: 'Créditos' },
            { value: 'debit', label: 'Débitos' },
          ] as const
        ).map((f) => (
          <button
            key={String(f.value)}
            onClick={() => setTypeFilter(f.value)}
            className={cn(
              'text-[10px] px-6 py-3 rounded-2xl font-black uppercase tracking-widest transition-all duration-300 active:scale-95',
              typeFilter === f.value
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'bg-transparent text-muted-foreground hover:bg-muted',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Entries Bento Table Area */}
      <ScaleIn>
        <div className="premium-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                    Timestamp / Data
                  </th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                    Descrição da Transação
                  </th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                    Subcategoria
                  </th>
                  <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                    Modalidade
                  </th>
                  <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                    Montante Final
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-24 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2 className="animate-spin text-primary/30" size={48} />
                        <Muted className="animate-pulse font-black uppercase tracking-[0.2em]">
                          Varrendo registros contábeis...
                        </Muted>
                      </div>
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <div className="p-20">
                        <EmptyState
                          icon={BookOpen}
                          title="Livro caixa sem registros"
                          description="Novos lançamentos automáticos (OS) ou manuais serão auditados aqui."
                        />
                      </div>
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="group hover:bg-primary/[0.01] transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground shadow-inner">
                            <Calendar size={16} strokeWidth={2.5} className="opacity-50" />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-black text-foreground uppercase tracking-tight">
                              {new Date(entry.referenceDate).toLocaleDateString('pt-BR')}
                            </span>
                            <Muted className="text-[9px] font-bold uppercase tracking-widest opacity-40">
                              Efetivação
                            </Muted>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-2 h-8 rounded-full',
                              entry.type === 'credit' ? 'bg-emerald-500/20' : 'bg-destructive/20',
                            )}
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-black text-foreground tracking-tight leading-none mb-1">
                              {entry.description}
                            </span>
                            <div className="flex items-center gap-1.5 opacity-60">
                              <Landmark size={10} className="text-muted-foreground" />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic leading-none whitespace-nowrap">
                                ID_{entry.id.toString().padStart(6, '0')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50 border border-border w-fit group-hover:bg-muted group-hover:border-primary/20 transition-colors">
                          <Tag
                            size={12}
                            className="text-primary/40 group-hover:text-primary transition-colors"
                          />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                            {entry.category ?? 'Operacional'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div
                          className={cn(
                            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] transition-all',
                            entry.type === 'credit'
                              ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white'
                              : 'bg-destructive/5 text-destructive border-destructive/20 group-hover:bg-destructive group-hover:text-white',
                          )}
                        >
                          {entry.type === 'credit' ? (
                            <ArrowUpRight size={10} strokeWidth={3} />
                          ) : (
                            <ArrowDownRight size={10} strokeWidth={3} />
                          )}
                          {entry.type === 'credit' ? 'Receita' : 'Despesa'}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right tabular-nums">
                        <div
                          className={cn(
                            'text-lg font-black tracking-tighter leading-none transition-all',
                            entry.type === 'credit'
                              ? 'text-emerald-500 group-hover:scale-105 origin-right'
                              : 'text-destructive group-hover:scale-105 origin-right',
                          )}
                        >
                          {entry.type === 'debit' ? '− ' : '+ '}
                          {formatBRL(entry.amountCents)}
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

      {/* Premium Create Manual Entry Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in fade-in duration-300">
          <ScaleIn className="w-full max-w-xl">
            <div
              className={cn(
                'premium-card p-10 flex flex-col gap-10 relative shadow-2xl overflow-hidden',
                form.type === 'debit'
                  ? 'bg-destructive/10 border-destructive text-destructive'
                  : 'border-primary/20',
              )}
            >
              {/* Accent decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10" />

              <div className="flex justify-between items-start relative">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <Receipt size={24} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <H1 className="text-2xl tracking-tighter">Lançamento Avulso</H1>
                    <Muted className="text-[10px] font-black uppercase tracking-[0.2em]">
                      Movimentação manual para o livro caixa
                    </Muted>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-all active:scale-90"
                >
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              <div className="flex flex-col gap-8 relative">
                <div>
                  <label className={labelClass}>Tipo de Fluxo *</label>
                  <div className="flex gap-4">
                    {(['credit', 'debit'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setForm((p) => ({ ...p, type: t }))}
                        className={cn(
                          'flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all duration-300 active:scale-[0.98] group/btn',
                          form.type === t
                            ? t === 'credit'
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-xl shadow-emerald-500/20'
                              : 'bg-destructive text-white border-destructive shadow-xl shadow-destructive/20'
                            : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/30',
                        )}
                      >
                        <div
                          className={cn(
                            'w-10 h-10 flex items-center justify-center rounded-xl transition-colors duration-300',
                            form.type === t
                              ? 'bg-white/20 text-white'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {t === 'credit' ? (
                            <TrendingUp size={20} strokeWidth={3} />
                          ) : (
                            <TrendingDown size={20} strokeWidth={3} />
                          )}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                          {t === 'credit' ? 'Crédito / Entrada' : 'Débito / Saída'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Descrição do Lançamento *</label>
                    <div className="relative">
                      <input
                        value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Ex: Recebimento parcial OS#123, Ajuste de saldo..."
                        className={inputClass}
                      />
                      <FileText
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50"
                        size={18}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Montante (R$) *</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={form.amountCents}
                        onChange={(e) => setForm((f) => ({ ...f, amountCents: e.target.value }))}
                        placeholder="0.00"
                        className={cn(
                          inputClass,
                          'font-mono font-bold text-lg',
                          form.type === 'debit' ? 'text-destructive' : 'text-emerald-500',
                        )}
                      />
                      <DollarSign
                        className={cn(
                          'absolute right-4 top-1/2 -translate-y-1/2 opacity-30',
                          form.type === 'debit' ? 'text-destructive' : 'text-emerald-500',
                        )}
                        size={18}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Data de Efetivação *</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={form.referenceDate}
                        onChange={(e) => setForm((f) => ({ ...f, referenceDate: e.target.value }))}
                        className={inputClass}
                      />
                      <Calendar
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 opacity-50"
                        size={18}
                      />
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
                  disabled={
                    !form.description ||
                    !form.amountCents ||
                    !form.referenceDate ||
                    createEntry.isPending
                  }
                  onClick={() =>
                    createEntry.mutate({
                      type: form.type,
                      amountCents: parseBRL(form.amountCents),
                      description: form.description,
                      referenceDate: new Date(`${form.referenceDate}T12:00:00`).toISOString(),
                    })
                  }
                  className="flex-[1.5] py-5 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
                >
                  {createEntry.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} strokeWidth={3} /> Efetivar Lançamento
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
