import { 
  CreditCard, Calendar, Users, Briefcase, 
  Database, ShieldCheck, Activity, TrendingUp,
  Landmark, CheckCircle2
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { Large, Muted } from '../shared/typography';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function PlanSummary() {
  const planQuery = trpc.fiscal.getPlanSummary.useQuery();
  const summary = planQuery.data;

  if (!summary) return null;

  const stats = [
    { label: 'Matriz de Usuários', value: `${summary.activeUsers}/${summary.userLimit}`, icon: Users, color: 'text-sky-500', bg: 'bg-sky-500/10' },
    { label: 'Cota de Armazenamento', value: `${(summary.storageUsedBytes / 1024 / 1024).toFixed(1)}MB`, icon: Database, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { label: 'Emissão de NFS-e', value: summary.isProfessional ? 'Ilimitado' : 'Consumo sob demanda', icon: Landmark, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Status Estratégico', value: summary.isActive ? 'Em conformidade' : 'Atenção Requerida', icon: Activity, color: summary.isActive ? 'text-primary' : 'text-rose-500', bg: summary.isActive ? 'bg-primary/10' : 'bg-rose-500/10' },
  ];

  return (
    <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Plan Header Bento */}
      <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] p-8 flex flex-col gap-8 relative overflow-hidden group/plan shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-6 relative">
           <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner ring-1 ring-primary/20">
                 <Briefcase size={28} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-3">
                    <Large className="text-2xl font-black uppercase tracking-tight">{summary.planName}</Large>
                    {summary.isProfessional && (
                      <div className="px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-[8px] font-black uppercase tracking-[0.2em] text-primary">
                         Premium Tier
                      </div>
                    )}
                 </div>
                 <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 italic">Arquitetura de licenciamento operacional</Muted>
              </div>
           </div>

           <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm">
                 <Calendar size={14} className="text-primary" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Próximo Ciclo: {format(new Date(summary.nextBillingDate), 'dd MMM yyyy', { locale: ptBR })}</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-500 px-3">
                 <CheckCircle2 size={12} strokeWidth={3} />
                 <span className="text-[8px] font-black uppercase tracking-[0.2em]">Pagamento em conformidade</span>
              </div>
           </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {stats.map((s, i) => (
            <div key={i} className="bg-muted/30 border border-border/30 rounded-2xl p-6 group/stat hover:border-primary/30 transition-all duration-500 overflow-hidden relative">
               <div className="flex items-center gap-4 mb-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner transition-transform group-hover/stat:scale-110", s.bg, s.color)}>
                     <s.icon size={18} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                     <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-60">{s.label}</span>
                     <span className="text-lg font-black text-foreground tracking-tight">{s.value}</span>
                  </div>
               </div>
               {/* Mini trend indicator */}
               <div className="flex items-center gap-1 text-[8px] font-black text-primary/40 uppercase tracking-widest mt-2 border-t border-border/10 pt-3">
                  <TrendingUp size={10} /> Consumo em Regime Nominal
               </div>
               <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-primary/[0.02] rounded-full blur-xl group-hover/stat:bg-primary/[0.05] transition-colors" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border/50 pt-8 mt-2">
           <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-black text-muted-foreground">
                    {i}
                  </div>
                ))}
              </div>
              <Muted className="text-[10px] font-bold uppercase tracking-tight opacity-60">Matriz de faturamento processada via Cloud-Nexus</Muted>
           </div>
           
           <button className="flex items-center gap-3 bg-muted border border-border text-foreground hover:bg-muted/80 px-10 py-4 rounded-2xl hover:scale-105 transition-all active:scale-95 text-[10px] font-black uppercase tracking-widest shadow-lg">
              <CreditCard size={16} strokeWidth={3} />
              Gerenciar Cartão e Faturas
           </button>
        </div>

        {/* Decorative backdrop */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.02] rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none group-hover/plan:bg-primary/[0.05] transition-colors duration-1000" />
      </div>

      <div className="bg-muted/20 border border-dashed border-border rounded-[24px] p-8 flex flex-col items-center gap-4 text-center">
         <div className="w-12 h-12 rounded-2xl bg-muted border border-border flex items-center justify-center text-muted-foreground opacity-40">
            <ShieldCheck size={24} strokeWidth={1} />
         </div>
         <div className="flex flex-col gap-1 max-w-lg">
            <Large className="text-sm font-black uppercase tracking-widest opacity-60">Escalabilidade Sob Demanda</Large>
            <Muted className="text-[10px] font-bold uppercase tracking-tight leading-relaxed opacity-40">
               Seu plano atual suporta até {summary.userLimit} usuários simultâneos. Para quotas customizadas de armazenamento ou endpoints de API dedicados, entre em contato com nossa célula de sucesso do cliente.
            </Muted>
         </div>
      </div>
    </div>
  );
}
