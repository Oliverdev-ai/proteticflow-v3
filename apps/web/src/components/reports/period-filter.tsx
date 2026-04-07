import { CalendarRange, Search } from 'lucide-react';

export type PeriodFilterState = {
  startDate: string;
  endDate: string;
};

type PeriodFilterProps = {
  value: PeriodFilterState;
  onChange: (value: PeriodFilterState) => void;
  onApply: () => void;
  isLoading?: boolean;
};

export function PeriodFilter({ value, onChange, onApply, isLoading = false }: PeriodFilterProps) {
  const labelClass =
    'mb-1.5 ml-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground';
  const inputClass =
    'w-full rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-xs font-bold text-foreground shadow-inner transition-all placeholder:opacity-30 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/5';

  return (
    <div className="premium-card grid grid-cols-1 gap-5 p-6 md:grid-cols-3 md:items-end">
      <div>
        <label className={labelClass}>
          <CalendarRange size={12} className="text-primary/50" />
          Inicio
        </label>
        <input
          type="date"
          value={value.startDate}
          onChange={(event) => onChange({ ...value, startDate: event.target.value })}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>
          <CalendarRange size={12} className="text-primary/50" />
          Fim
        </label>
        <input
          type="date"
          value={value.endDate}
          onChange={(event) => onChange({ ...value, endDate: event.target.value })}
          className={inputClass}
        />
      </div>

      <div>
        <button
          onClick={onApply}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 disabled:opacity-60"
        >
          <Search size={16} />
          {isLoading ? 'Aplicando...' : 'Aplicar periodo'}
        </button>
      </div>
    </div>
  );
}
