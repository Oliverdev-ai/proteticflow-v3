import {
  CreditCard, Calendar, Users, Briefcase,
  Database, Activity, TrendingUp,
  Landmark, CheckCircle2,
} from 'lucide-react';
import { useSettings } from '../../hooks/use-settings';
import { Large, Muted } from '../shared/typography';
import { cn } from '../../lib/utils';

const PLAN_DISPLAY_NAME: Record<'trial' | 'starter' | 'pro' | 'enterprise', string> = {
  trial: 'trial',
  starter: 'starter',
  pro: 'pro',
  enterprise: 'enterprise',
};

function formatPlanExpiry(dateIso: string | null) {
  if (!dateIso) return 'sem vencimento';
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return 'data inválida';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function PlanSummary() {
  const { overview } = useSettings();
  const summary = overview.data?.plan;

  if (!summary) return null;

  const stats = [
    { label: 'Clientes', value: summary.clientCount.toString(), icon: Users, color: 'text-[var(--info)]', bg: 'bg-[var(--info-soft)]' },
    { label: 'Ordens/Mês', value: summary.jobCountThisMonth.toString(), icon: Briefcase, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Usuários', value: summary.userCount.toString(), icon: Activity, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Storage (MB)', value: summary.storageUsedMb.toString(), icon: Database, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Tabelas de Preço', value: summary.priceTableCount.toString(), icon: Landmark, color: 'text-[var(--warning)]', bg: 'bg-[var(--warning-soft)]' },
  ];

  return (
    <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-lg p-8 flex flex-col gap-8 relative overflow-hidden group/plan shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-6 relative">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-lg bg-primary/10 text-primary flex items-center justify-center shadow-inner ring-1 ring-primary/20">
              <CreditCard size={28} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col gap-1">
              <Large className="text-2xl font-semibold uppercase tracking-tight">
                Plano {PLAN_DISPLAY_NAME[summary.current]}
              </Large>
              <Muted className="text-[10px] font-semibold uppercase tracking-normal opacity-40 italic">
                Arquitetura de licenciamento operacional
              </Muted>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-card/50 border border-border/50 backdrop-blur-sm">
              <Calendar size={14} className="text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-normal text-foreground">
                Vencimento: {formatPlanExpiry(summary.planExpiresAt)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-success px-3">
              <CheckCircle2 size={12} strokeWidth={3} />
              <span className="text-[8px] font-semibold uppercase tracking-normal">Licença ativa</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 relative">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-muted/30 border border-border/30 rounded-lg p-6 group/stat hover:border-primary/30 transition-all duration-500 overflow-hidden relative"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shadow-inner transition-transform group-hover/stat:scale-110', stat.bg, stat.color)}>
                  <stat.icon size={18} strokeWidth={3} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-semibold uppercase tracking-normal text-muted-foreground opacity-60">{stat.label}</span>
                  <span className="text-lg font-semibold text-foreground tracking-tight">{stat.value}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[8px] font-semibold text-primary/40 uppercase tracking-normal mt-2 border-t border-border/10 pt-3">
                <TrendingUp size={10} /> Consumo em regime nominal
              </div>
              <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-primary/[0.02] rounded-full blur-xl group-hover/stat:bg-primary/[0.05] transition-colors" />
            </div>
          ))}
        </div>

        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.02] rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/plan:bg-primary/[0.05] transition-colors duration-1000" />
      </div>
    </div>
  );
}
