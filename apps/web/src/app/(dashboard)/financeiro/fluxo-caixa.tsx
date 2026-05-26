import { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Loader2,
  Activity,
  ChevronLeft,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatBRL } from '../../../lib/format';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { PageTitle, Subtitle, Muted, Large } from '../../../components/shared/typography';
import { EmptyState } from '../../../components/shared/empty-state';
import { cn } from '../../../lib/utils';

function BarSegment({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden shadow-inner border border-border/50">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-1000 ease-in-out shadow-sm',
          color,
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function FluxoCaixaPage() {
  const now = new Date();
  const [dateFrom] = useState(new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString());
  const [dateTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString());

  const { data, isLoading } = trpc.financial.cashFlow.useQuery({ dateFrom, dateTo });

  const months = data?.months ?? [];
  const projection = data?.projection;

  const maxVal = Math.max(...months.map((m) => Math.max(m.credits, m.debits)), 1);

  const shortMonth = (monthStr: string) => {
    const [y, m] = monthStr.split('-');
    return new Date(parseInt(y ?? '0', 10), parseInt(m ?? '1', 10) - 1).toLocaleDateString(
      'pt-BR',
      { month: 'short', year: '2-digit' },
    );
  };

  return (
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-6xl mx-auto pb-12">
      {/* Header Area */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link
            to="/financeiro"
            className="w-12 h-12 flex items-center justify-center rounded-lg bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all  shadow-sm"
          >
            <ChevronLeft size={20} strokeWidth={3} />
          </Link>
          <div className="flex flex-col gap-0.5">
            <PageTitle className="tracking-tight">Fluxo de Caixa</PageTitle>
            <Subtitle>Inteligência financeira e projeção de liquidez mensal</Subtitle>
          </div>
        </div>
      </div>

      {/* Projections Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ScaleIn className="premium-card p-8 border-success/10 bg-success/[0.01] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full blur-3xl -mr-10 -mt-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

          <div className="flex flex-col gap-6 relative">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-success/10 text-success shadow-inner border border-success/10">
                <TrendingUp size={22} strokeWidth={2.5} />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/20 text-[10px] font-semibold uppercase tracking-normal text-success">
                <Clock size={12} strokeWidth={3} /> Projeção Positiva
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Muted className="text-[10px] font-semibold uppercase tracking-normal ml-1">
                Recebimentos Pendentes
              </Muted>
              <Large className="text-4xl font-semibold tracking-tighter text-success">
                {projection ? formatBRL(projection.pendingCredits) : '—'}
              </Large>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-success/10">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-normal">
                Baseado em faturas AR com status pendente
              </span>
            </div>
          </div>
        </ScaleIn>

        <ScaleIn className="premium-card p-8 border-destructive/10 bg-destructive/[0.01] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/5 rounded-full blur-3xl -mr-10 -mt-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

          <div className="flex flex-col gap-6 relative">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-destructive/10 text-destructive shadow-inner border border-destructive/10">
                <TrendingDown size={22} strokeWidth={2.5} />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-[10px] font-semibold uppercase tracking-normal text-destructive">
                <Clock size={12} strokeWidth={3} /> Saídas Previstas
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Muted className="text-[10px] font-semibold uppercase tracking-normal ml-1">
                Compromissos do Passivo
              </Muted>
              <Large className="text-4xl font-semibold tracking-tighter text-destructive">
                {projection ? formatBRL(projection.pendingDebits) : '—'}
              </Large>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-destructive/10">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-normal">
                Baseado em contas AP não liquidadas
              </span>
            </div>
          </div>
        </ScaleIn>
      </div>

      {/* Monthly History Visualization */}
      <ScaleIn delay={0.2}>
        <div className="premium-card p-10 relative overflow-hidden">
          <div className="flex items-center justify-between mb-12 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-primary text-white shadow-lg shadow-sm">
                <BarChart3 size={24} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-0.5">
                <Large className="tracking-tight">Histórico de Performance</Large>
                <Muted className="text-[10px] font-semibold uppercase tracking-normal">
                  Consolidado Entradas vs Saídas
                </Muted>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                  Créditos
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                <span className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                  Débitos
                </span>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-primary/30" size={48} />
              <Muted className="font-semibold uppercase tracking-normal animate-pulse">
                Processando extratos...
              </Muted>
            </div>
          ) : months.length === 0 ? (
            <div className="p-20">
              <EmptyState
                icon={Activity}
                title="Sem histórico registrado"
                description="Os dados de fluxo de caixa serão populados conforme as movimentações financeiras ocorrerem."
              />
            </div>
          ) : (
            <div className="space-y-4">
              {[...months].reverse().map((m, _idx) => (
                <div
                  key={m.month}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center p-6 border border-border/40 hover:border-primary/30 hover:bg-primary/[0.01] rounded-lg transition-all duration-500 group relative"
                >
                  <div className="lg:col-span-2 flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-normal">
                      {shortMonth(m.month)}
                    </span>
                    <Muted className="text-[10px] font-bold opacity-60 uppercase">
                      {m.month.split('-')[0]}
                    </Muted>
                  </div>

                  <div className="lg:col-span-6 flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-[100px] flex items-center gap-1.5">
                        <TrendingUp size={12} className="text-success" />
                        <span className="text-[10px] font-semibold text-success tracking-tighter w-full">
                          {formatBRL(m.credits)}
                        </span>
                      </div>
                      <BarSegment value={m.credits} max={maxVal} color="bg-success" />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-[100px] flex items-center gap-1.5">
                        <TrendingDown size={12} className="text-destructive" />
                        <span className="text-[10px] font-semibold text-destructive tracking-tighter w-full">
                          {formatBRL(m.debits)}
                        </span>
                      </div>
                      <BarSegment value={m.debits} max={maxVal} color="bg-destructive" />
                    </div>
                  </div>

                  <div className="lg:col-span-4 flex items-center justify-end gap-6">
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-normal opacity-60">
                        Margem Líquida
                      </span>
                      <span
                        className={cn(
                          'text-xl font-semibold tracking-tighter tabular-nums leading-none',
                          m.net >= 0 ? 'text-success' : 'text-destructive',
                        )}
                      >
                        {m.net > 0 && '+'}
                        {formatBRL(m.net)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'w-10 h-10 flex items-center justify-center rounded-xl border transition-all duration-500',
                        m.net >= 0
                          ? 'bg-success/10 text-success border-success/20 group-hover:bg-success group-hover:text-white'
                          : 'bg-destructive/10 text-destructive border-destructive/20 group-hover:bg-destructive group-hover:text-white',
                      )}
                    >
                      {m.net >= 0 ? (
                        <ArrowUpRight size={20} strokeWidth={3} />
                      ) : (
                        <ArrowDownRight size={20} strokeWidth={3} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 p-6 bg-muted/30 border border-border/50 rounded-lg flex items-start gap-4">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Info size={20} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-foreground uppercase tracking-tight">
                O Fluxo de Caixa Real
              </span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Este gráfico representa apenas as liquidações confirmadas (contas pagas e
                recebidas). Para previsões baseadas em datas futuras, consulte o módulo de{' '}
                <strong>Projeções</strong> no topo da página.
              </p>
            </div>
          </div>
        </div>
      </ScaleIn>
    </PageTransition>
  );
}
