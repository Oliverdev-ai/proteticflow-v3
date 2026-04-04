import { Calendar, Filter, BarChart3, Users, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ReportFiltersState = {
  dateFrom: string;
  dateTo: string;
  includeCharts: boolean;
  includeBreakdownByClient: boolean;
  groupBy: 'month' | 'quarter' | 'year';
};

type ReportFiltersProps = {
  value: ReportFiltersState;
  onChange: (next: ReportFiltersState) => void;
};

export function ReportFilters({ value, onChange }: ReportFiltersProps) {
  const labelClass = "text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1.5";
  const inputClass = "w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all shadow-inner placeholder:opacity-30";

  return (
    <div className="premium-card p-6 grid grid-cols-1 md:grid-cols-5 gap-6 items-end relative overflow-hidden group">
      {/* Date From */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>
           <Calendar size={12} className="text-primary/40" /> Início
        </label>
        <div className="relative">
          <input
            type="date"
            value={value.dateFrom}
            onChange={(event) => onChange({ ...value, dateFrom: event.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      {/* Date To */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>
           <Calendar size={12} className="text-primary/40" /> Término
        </label>
        <div className="relative">
          <input
            type="date"
            value={value.dateTo}
            onChange={(event) => onChange({ ...value, dateTo: event.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      {/* Group By */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>
           <Filter size={12} className="text-primary/40" /> Agrupar
        </label>
        <div className="relative">
          <select
            value={value.groupBy}
            onChange={(event) => onChange({ ...value, groupBy: event.target.value as ReportFiltersState['groupBy'] })}
            className={cn(inputClass, "appearance-none pr-10 cursor-pointer")}
          >
            <option value="month">Mensal</option>
            <option value="quarter">Trimestral</option>
            <option value="year">Anual</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none" size={14} strokeWidth={3} />
        </div>
      </div>

      {/* Checkboxes */}
      <div className="flex items-center gap-6 h-10 md:col-span-2 px-2">
        <label className="flex items-center gap-3 cursor-pointer group/check">
          <div className="relative">
             <input
               type="checkbox"
               checked={value.includeCharts}
               onChange={(event) => onChange({ ...value, includeCharts: event.target.checked })}
               className="peer sr-only"
             />
             <div className="w-10 h-5 bg-muted rounded-full border border-border peer-checked:bg-primary/20 peer-checked:border-primary/50 transition-all" />
             <div className="absolute left-1 top-1 w-3 h-3 bg-muted-foreground rounded-full transition-all peer-checked:left-6 peer-checked:bg-primary shadow-sm" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover/check:text-primary transition-colors">Gráficos</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer group/check">
          <div className="relative">
             <input
               type="checkbox"
               checked={value.includeBreakdownByClient}
               onChange={(event) => onChange({ ...value, includeBreakdownByClient: event.target.checked })}
               className="peer sr-only"
             />
             <div className="w-10 h-5 bg-muted rounded-full border border-border peer-checked:bg-primary/20 peer-checked:border-primary/50 transition-all" />
             <div className="absolute left-1 top-1 w-3 h-3 bg-muted-foreground rounded-full transition-all peer-checked:left-6 peer-checked:bg-primary shadow-sm" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover/check:text-primary transition-colors">Breakdown</span>
        </label>
      </div>

      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/[0.02] rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
    </div>
  );
}
