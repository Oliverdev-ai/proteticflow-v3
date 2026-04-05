import type { ReportPreviewResult } from '@proteticflow/shared';
import { BarChart3, TrendingUp, Info, PieChart } from 'lucide-react';
import { Large, Muted } from '../shared/typography';
import { EmptyState } from '../shared/empty-state';

type ReportChartProps = {
  preview: ReportPreviewResult | null;
};

export function ReportChart({ preview }: ReportChartProps) {
  if (!preview) {
    return null; // Don't show if no preview
  }

  const numericSummary = Object.entries(preview.summary).filter(([, value]) => typeof value === 'number') as Array<[string, number]>;
  
  if (numericSummary.length === 0) {
    return (
      <div className="premium-card p-10 flex flex-col items-center justify-center text-center opacity-40 border-dashed border-2">
         <EmptyState 
           icon={PieChart} 
           title="Métricas de Resumo" 
           description="Este relatório não possui indicadores numéricos para visualização gráfica." 
         />
      </div>
    );
  }

  const max = numericSummary.reduce((acc, [, value]) => Math.max(acc, value), 1);

  return (
    <div className="premium-card p-10 flex flex-col gap-10 relative overflow-hidden group">
      <div className="flex items-center justify-between border-b border-border/50 pb-8 relative">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
               <TrendingUp size={24} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col gap-0.5">
               <Large className="tracking-tight">Indicadores de Desempenho</Large>
               <Muted className="text-[10px] font-black uppercase tracking-[0.3em]">Consolidado de métricas operacionais</Muted>
            </div>
         </div>
         <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-2xl border border-border">
            <BarChart3 size={14} className="text-primary/40" />
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Snapshot Real-time</span>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 relative">
        {numericSummary.map(([key, value], idx) => {
           const pct = Math.max(5, (value / max) * 100);
           return (
              <div key={key} className="flex flex-col gap-3 group/item animate-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 100}ms` }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-primary/20 group-hover/item:bg-primary transition-colors" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover/item:text-foreground transition-colors">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  </div>
                  <span className="text-sm font-black text-foreground tabular-nums group-hover/item:text-primary transition-colors">{typeof value === 'number' && key.toLowerCase().includes('amount') ? `R$ ${value.toLocaleString('pt-BR')}` : value}</span>
                </div>
                <div className="h-2 w-full bg-muted shadow-inner rounded-full overflow-hidden border border-border/50">
                   <div 
                     className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all duration-1000 ease-in-out shadow-sm"
                     style={{ width: `${pct}%` }}
                   />
                </div>
              </div>
           );
        })}
      </div>

      <div className="p-6 bg-primary/[0.02] border border-primary/10 rounded-[32px] flex items-center gap-4 mt-4">
         <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <Info size={18} strokeWidth={2.5} />
         </div>
         <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Inteligência de Dados</span>
            <p className="text-[10px] text-muted-foreground leading-relaxed uppercase tracking-tight font-bold opacity-60">
               As métricas acima são calculadas dinamicamente com base nos filtros operacionais aplicados.
            </p>
         </div>
      </div>

      <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[100px] -mr-32 -mb-32 pointer-events-none" />
    </div>
  );
}
