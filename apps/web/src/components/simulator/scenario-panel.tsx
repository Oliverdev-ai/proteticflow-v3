import type { SimulationCalculationResult } from '@proteticflow/shared';

type ScenarioPanelProps = {
  preview: SimulationCalculationResult | null;
  onPreview: () => void;
};

export function ScenarioPanel({ preview, onPreview }: ScenarioPanelProps) {
  return (
    <div className="rounded-lg border border-border bg-muted p-5 space-y-3">
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
        <p className="text-sm text-muted-foreground">Execute o calculo para visualizar subtotal, total e margem.</p>
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
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs uppercase tracking-normal text-muted-foreground">{title}</p>
      <p className="text-xl font-semibold text-white">R$ {(value / 100).toFixed(2)}</p>
      {suffix ? <p className="text-xs text-muted-foreground">{suffix}</p> : null}
    </div>
  );
}
