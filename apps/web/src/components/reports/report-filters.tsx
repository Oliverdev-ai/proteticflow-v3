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
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
      <label className="text-sm text-neutral-300">
        De
        <input
          type="date"
          value={value.dateFrom}
          onChange={(event) => onChange({ ...value, dateFrom: event.target.value })}
          className="input-field mt-1 w-full"
        />
      </label>
      <label className="text-sm text-neutral-300">
        Ate
        <input
          type="date"
          value={value.dateTo}
          onChange={(event) => onChange({ ...value, dateTo: event.target.value })}
          className="input-field mt-1 w-full"
        />
      </label>
      <label className="text-sm text-neutral-300">
        Agrupar
        <select
          value={value.groupBy}
          onChange={(event) => onChange({ ...value, groupBy: event.target.value as ReportFiltersState['groupBy'] })}
          className="input-field mt-1 w-full"
        >
          <option value="month">Mes</option>
          <option value="quarter">Trimestre</option>
          <option value="year">Ano</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-neutral-300 mt-6">
        <input
          type="checkbox"
          checked={value.includeCharts}
          onChange={(event) => onChange({ ...value, includeCharts: event.target.checked })}
        />
        Incluir graficos
      </label>
      <label className="flex items-center gap-2 text-sm text-neutral-300 mt-6">
        <input
          type="checkbox"
          checked={value.includeBreakdownByClient}
          onChange={(event) => onChange({ ...value, includeBreakdownByClient: event.target.checked })}
        />
        Breakdown por cliente
      </label>
    </div>
  );
}
