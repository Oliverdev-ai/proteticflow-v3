type PreviewDetail = {
  label: string;
  value: string;
};

type FlowActionConfirmationProps = {
  runId: number;
  command: string;
  preview?: {
    title: string;
    summary: string;
    details: PreviewDetail[];
  };
  isSubmitting?: boolean;
  onConfirm: (runId: number) => Promise<void>;
  onCancel: (runId: number) => Promise<void>;
};

export function FlowActionConfirmation({
  runId,
  command,
  preview,
  isSubmitting,
  onConfirm,
  onCancel,
}: FlowActionConfirmationProps) {
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-zinc-900 p-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wider text-amber-300">Confirmacao necessaria</p>
        <h3 className="text-sm font-semibold text-zinc-100 mt-1">{preview?.title ?? command}</h3>
        <p className="text-xs text-zinc-400 mt-1">{preview?.summary ?? 'Revise os dados antes de confirmar.'}</p>
      </div>

      {preview?.details?.length ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-1">
          {preview.details.map((detail) => (
            <div key={`${detail.label}-${detail.value}`} className="text-xs text-zinc-300">
              <span className="text-zinc-500">{detail.label}:</span> {detail.value}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onConfirm(runId)}
          disabled={isSubmitting}
          className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-sky-950 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={() => void onCancel(runId)}
          disabled={isSubmitting}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

