import { Link } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Activity,
  FileText,
  BookOpen,
  BarChart3,
  ChevronRight,
  ArrowUpRight,
  Receipt,
  CreditCard,
  PieChart,
  ArrowDownRight,
  Landmark,
  ArrowRight,
} from 'lucide-react';
import { formatBRL } from '../../../lib/format';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted, Large } from '../../../components/shared/typography';
import { cn } from '../../../lib/utils';

function SummaryCard({
  label,
  value,
  icon: Icon,
  sub,
  color,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
  color: 'emerald' | 'destructive' | 'amber' | 'primary';
  trend?: { value: string; positive: boolean };
}) {
  const colorMap = {
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    primary: 'bg-primary/10 text-primary border-primary/20',
  };

  return (
    <ScaleIn className="premium-card p-6 flex flex-col gap-4 group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="flex items-start justify-between relative">
        <div
          className={cn(
            'p-3 rounded-2xl border shadow-inner transition-all duration-500 group-hover:scale-110',
            colorMap[color],
          )}
        >
          <Icon size={22} strokeWidth={2.5} />
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border',
              trend.positive
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-destructive/10 text-destructive border-destructive/20',
            )}
          >
            {trend.positive ? (
              <ArrowUpRight size={10} strokeWidth={3} />
            ) : (
              <ArrowDownRight size={10} strokeWidth={3} />
            )}
            {trend.value}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5 relative">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <Large className="text-3xl font-black tracking-tighter leading-tight">{value}</Large>
        </div>
        {sub && (
          <Muted className="text-[10px] font-bold uppercase tracking-widest opacity-60">
            {sub}
          </Muted>
        )}
      </div>
    </ScaleIn>
  );
}

const MODULES = [
  {
    id: 'ar',
    label: 'Contas a Receber',
    href: '/financeiro/contas-receber',
    icon: TrendingUp,
    desc: 'Gestão de faturamento',
  },
  {
    id: 'ap',
    label: 'Contas a Pagar',
    href: '/financeiro/contas-pagar',
    icon: TrendingDown,
    desc: 'Controle de despesas',
  },
  {
    id: 'cashflow',
    label: 'Fluxo de Caixa',
    href: '/financeiro/fluxo-caixa',
    icon: BarChart3,
    desc: 'Visão de caixa real',
  },
  {
    id: 'cashbook',
    label: 'Livro Caixa',
    href: '/financeiro/livro-caixa',
    icon: BookOpen,
    desc: 'Lançamentos detalhados',
  },
  {
    id: 'closing',
    label: 'Fechamentos',
    href: '/financeiro/fechamento',
    icon: FileText,
    desc: 'Apuração de resultados',
  },
] as const;

export default function FinancialDashboard() {
  const { data: summary, isLoading } = trpc.financial.dashboardSummary.useQuery();

  return (
    <PageTransition className="flex flex-col gap-10 h-full overflow-auto p-4 md:p-1 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <H1 className="tracking-tight">Gestão Financeira</H1>
        <Subtitle>Painel estratégico de faturamento e fluxo de caixa</Subtitle>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <SummaryCard
          label="Total a Receber"
          icon={Receipt}
          value={isLoading ? '—' : formatBRL(summary?.totalReceivableCents ?? 0)}
          sub="Previsão de entrada"
          color="emerald"
        />
        <SummaryCard
          label="Total a Pagar"
          icon={CreditCard}
          value={isLoading ? '—' : formatBRL(summary?.totalPayableCents ?? 0)}
          sub="Compromissos pendentes"
          color="destructive"
        />
        <SummaryCard
          label="Saldos Vencidos"
          icon={AlertTriangle}
          value={isLoading ? '—' : formatBRL(summary?.overdueCents ?? 0)}
          sub="Atenção necessária"
          color="amber"
        />
        <SummaryCard
          label="Resultado Mensal"
          icon={Landmark}
          value={isLoading ? '—' : formatBRL(summary?.monthFlowCents ?? 0)}
          sub="Fluxo operacional líquido"
          color={(summary?.monthFlowCents ?? 0) >= 0 ? 'primary' : 'destructive'}
        />
      </div>

      {/* Quick Navigation & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation Tiles */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center gap-4 ml-1">
            <div className="w-1 h-3 bg-primary rounded-full" />
            <Muted className="text-[10px] font-black uppercase tracking-[0.3em]">
              Módulos Operacionais
            </Muted>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MODULES.map(({ id, label, href, icon: Icon, desc }) => (
              <Link
                key={id}
                to={href}
                className="premium-card p-8 flex items-center justify-between group hover:border-primary/50 hover:bg-primary/[0.02] transition-all duration-500 hover:-translate-y-1 active:scale-[0.98]"
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 flex items-center justify-center rounded-[24px] bg-secondary border border-border group-hover:bg-primary/10 group-hover:text-primary transition-all duration-500 shadow-inner group-hover:rotate-6">
                    <Icon
                      size={28}
                      className="text-muted-foreground group-hover:text-primary transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-black text-foreground group-hover:text-primary transition-colors tracking-tight">
                      {label}
                    </span>
                    <Muted className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                      {desc}
                    </Muted>
                  </div>
                </div>
                <div className="w-10 h-10 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-500 text-primary">
                  <ChevronRight size={20} strokeWidth={3} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Informational Widget / Premium Placeholder */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center gap-4 ml-1">
            <div className="w-1 h-3 bg-primary rounded-full" />
            <Muted className="text-[10px] font-black uppercase tracking-[0.3em]">
              Insights Flash
            </Muted>
          </div>

          <ScaleIn
            delay={0.2}
            className="premium-card p-10 bg-primary/5 border-primary/20 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-[80px] -mr-20 -mt-20 anim-pulse" />

            <div className="flex flex-col gap-6 relative">
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                <Activity size={24} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xl font-black tracking-tighter leading-tight">
                  Saúde Financeira estável
                </p>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  O laboratório apresenta um índice de inadimplência de{' '}
                  <span className="text-emerald-500 font-bold">2.4%</span> este mês. Continue
                  monitorando os vencimentos em atraso.
                </p>
              </div>
              <div className="pt-4 border-t border-primary/10">
                <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary hover:brightness-110 transition-all">
                  Ver Relatório Analítico <ArrowRight size={14} strokeWidth={3} />
                </button>
              </div>
            </div>
          </ScaleIn>

          <ScaleIn
            delay={0.4}
            className="premium-card p-6 flex items-center gap-4 group cursor-pointer hover:bg-muted/50 transition-colors border-dashed"
          >
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
              <PieChart size={20} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Dica de Gestão
              </span>
              <span className="text-[11px] font-bold text-foreground">
                Otimize suas compras de estoque centralizadas.
              </span>
            </div>
          </ScaleIn>
        </div>
      </div>
    </PageTransition>
  );
}
