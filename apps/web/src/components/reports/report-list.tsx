import type { ReportDefinition } from '@proteticflow/shared';
import { FileText, ChevronRight, Lock, Activity, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';

type ReportListProps = {
  reports: ReportDefinition[];
  selectedType: ReportDefinition['type'] | null;
  onSelect: (type: ReportDefinition['type']) => void;
};

export function ReportList({ reports, selectedType, onSelect }: ReportListProps) {
  return (
    <div className="premium-card p-8 flex flex-col gap-6 relative overflow-hidden h-fit">
      <div className="flex items-center gap-3 border-b border-border/50 pb-6 relative">
         <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Activity size={20} strokeWidth={2.5} />
         </div>
         <div className="flex flex-col gap-0.5">
            <Large className="tracking-tight text-base font-black">Catálogo de Relatórios</Large>
            <Muted className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 italic">Selecione o modelo operacional</Muted>
         </div>
      </div>

      <div className="flex flex-col gap-3 relative max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
        {reports.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
             <FileText size={32} className="text-muted-foreground/20" />
             <Muted className="text-[10px] font-black uppercase tracking-widest max-w-[150px]">Nenhum modelo disponível para este tenant.</Muted>
          </div>
        ) : reports.map((report) => {
          const isSelected = selectedType === report.type;
          const isDisabled = !report.enabled;
          
          return (
            <button
              key={report.type}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(report.type)}
              className={cn(
                "group w-full text-left p-4 rounded-2xl border-2 transition-all duration-500 relative flex items-center gap-4 active:scale-[0.98] overflow-hidden",
                isSelected 
                  ? 'border-primary bg-primary/[0.03] shadow-lg shadow-primary/5' 
                  : isDisabled 
                    ? 'border-transparent bg-muted/20 opacity-40 grayscale cursor-not-allowed'
                    : 'border-border/40 bg-card/50 hover:border-primary/30 hover:bg-muted/50'
              )}
            >
              <div className={cn(
                "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-500 shadow-inner shrink-0",
                isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground/40 group-hover:bg-primary/10 group-hover:text-primary"
              )}>
                {isDisabled ? <Lock size={16} /> : <FileText size={18} strokeWidth={2.5} />}
              </div>

              <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                <p className={cn("text-xs font-black uppercase tracking-tight truncate transition-colors", isSelected ? 'text-primary' : 'text-foreground')}>
                  {report.title}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground opacity-60 truncate">
                  {report.description}
                </p>
                {isDisabled && (
                   <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest mt-1 bg-amber-500/10 px-2 rounded-full w-fit border border-amber-500/20">
                     {report.dependencyNote ?? 'Bloqueado'}
                   </span>
                )}
              </div>

              <div className={cn(
                "w-6 h-6 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100",
                isSelected ? "bg-emerald-500 text-white opacity-100" : "text-primary group-hover:translate-x-1"
              )}>
                {isSelected ? <CheckCircle2 size={14} strokeWidth={3} /> : <ChevronRight size={16} strokeWidth={3} />}
              </div>

              {isSelected && <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-full -mr-10 -mt-10 animate-pulse" />}
            </button>
          );
        })}
      </div>
      
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/[0.01] rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
    </div>
  );
}
