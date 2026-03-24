import type { ReportDefinition } from '@proteticflow/shared';

type ReportListProps = {
  reports: ReportDefinition[];
  selectedType: ReportDefinition['type'] | null;
  onSelect: (type: ReportDefinition['type']) => void;
};

export function ReportList({ reports, selectedType, onSelect }: ReportListProps) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-2">
      <h2 className="text-lg font-semibold text-white">Tipos de relatorio</h2>
      <div className="space-y-2 max-h-80 overflow-auto pr-1">
        {reports.map((report) => (
          <button
            key={report.type}
            type="button"
            onClick={() => onSelect(report.type)}
            className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
              selectedType === report.type ? 'border-violet-500 bg-violet-500/10' : 'border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <p className="text-sm font-medium text-neutral-100">{report.title}</p>
            <p className="text-xs text-neutral-400 mt-1">{report.description}</p>
            {!report.enabled ? <p className="text-xs text-amber-400 mt-1">{report.dependencyNote ?? 'Indisponivel nesta fase'}</p> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
