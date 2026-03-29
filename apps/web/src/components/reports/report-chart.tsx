import type { ReportPreviewResult } from '@proteticflow/shared';

type ReportChartProps = {
  preview: ReportPreviewResult | null;
};

export function ReportChart({ preview }: ReportChartProps) {
  if (!preview) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-500">
        Sem dados para grafico.
      </div>
    );
  }

  const numericSummary = Object.entries(preview.summary).filter(([, value]) => typeof value === 'number') as Array<[string, number]>;
  const max = numericSummary.reduce((acc, [, value]) => Math.max(acc, value), 1);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
      <h2 className="text-lg font-semibold text-white">Resumo visual</h2>
      <div className="space-y-2">
        {numericSummary.map(([key, value]) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>{key}</span>
              <span>{value}</span>
            </div>
            <div className="h-2 rounded bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-violet-500"
                style={{ width: `${Math.max(5, (value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        {numericSummary.length === 0 ? <p className="text-sm text-neutral-500">Resumo sem metricas numericas.</p> : null}
      </div>
    </div>
  );
}
