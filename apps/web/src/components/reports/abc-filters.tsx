import { CalendarRange, Filter, PlayCircle } from 'lucide-react';

export type AbcCurveType = 'services' | 'clients' | 'materials' | 'technicians';

export type AbcFiltersState = {
  type: AbcCurveType;
  startDate: string;
  endDate: string;
};

type AbcFiltersProps = {
  value: AbcFiltersState;
  onChange: (next: AbcFiltersState) => void;
  onGenerate: () => void;
  isLoading: boolean;
};

const TYPE_OPTIONS: Array<{ value: AbcCurveType; label: string }> = [
  { value: 'services', label: 'Servicos por faturamento' },
  { value: 'clients', label: 'Dentistas por faturamento' },
  { value: 'materials', label: 'Materiais por custo' },
  { value: 'technicians', label: 'Proteticos por volume' },
];

export function AbcFilters({ value, onChange, onGenerate, isLoading }: AbcFiltersProps) {
  const labelClass =
    'mb-1.5 ml-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground';
  const inputClass =
    'w-full rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-xs font-bold text-foreground shadow-inner transition-all placeholder:opacity-30 focus:border-primary/50 focus:outline-none focus:ring-4 focus:ring-primary/5';

  return (
    <div className="premium-card grid grid-cols-1 gap-5 p-6 md:grid-cols-4 md:items-end">
      <div className="md:col-span-2">
        <label className={labelClass}>
          <Filter size={12} className="text-primary/50" />
          Tipo de Analise
        </label>
        <select
          value={value.type}
          onChange={(event) => onChange({ ...value, type: event.target.value as AbcCurveType })}
          className={inputClass}
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

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

      <div className="md:col-span-4">
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 disabled:opacity-60"
        >
          <PlayCircle size={16} />
          {isLoading ? 'Gerando...' : 'Gerar Relatorio'}
        </button>
      </div>
    </div>
  );
}

