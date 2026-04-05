import type { SimulationCalculationResult } from '@proteticflow/shared';

type ScenarioPanelProps = {
  preview: SimulationCalculationResult | null;
  onPreview: () => void;
};

export function ScenarioPanel({ preview, onPreview }: ScenarioPanelProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Cenario e resultado</h2>
        <button
          type="button"
          onClick={onPreview}
          className="px-4 py-2 rounded-lg bg-primary hover:bg-primary text-white text-sm"
        >
          Recalcular
        </button>
      </div>

      {!preview ? (
        <p className="text-sm text-zinc-500">Execute o calculo para visualizar subtotal, total e margem.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Metric title="Subtotal" value={preview.subtotalCents} />
          <Metric title="Total" value={preview.totalCents} />
          <Metric title="Margem" value={preview.estimatedMarginCents} suffix={`(${preview.estimatedMarginPercent}%)`} />
        </div>
      )}
    </div>
  );
}

function Metric({ title, value, suffix }: { title: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl border border-zinc-700 p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="text-xl font-semibold text-white">R$ {(value / 100).toFixed(2)}</p>
      {suffix ? <p className="text-xs text-zinc-400">{suffix}</p> : null}
    </div>
  );
}
