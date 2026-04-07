import { useMemo, useState } from 'react';

type PreviewDetail = {
  label: string;
  value: string;
};

type CommandPreview = {
  title: string;
  summary: string;
  details: PreviewDetail[];
};

type ConfirmationStep =
  | {
    type: 'disambiguate';
    field: string;
    options: Array<{ id: number; label: string; detail?: string }>;
  }
  | {
    type: 'fill_missing';
    fields: Array<{ name: string; label: string; type: string; required: boolean }>;
  }
  | {
    type: 'review';
    preview: CommandPreview;
  }
  | {
    type: 'confirm';
    warning: string;
    action: string;
    preview?: CommandPreview;
  };

type FlowActionConfirmationProps = {
  runId: number;
  command: string;
  preview?: CommandPreview;
  step?: ConfirmationStep;
  isSubmitting?: boolean;
  onConfirm: (runId: number) => Promise<void>;
  onCancel: (runId: number) => Promise<void>;
  onResolve?: (runId: number, values: Record<string, unknown>) => Promise<void>;
};

function castFieldValue(type: string, rawValue: string): unknown {
  if (type === 'number') return Number(rawValue);
  if (type === 'boolean') return rawValue === 'true';
  return rawValue;
}

export function FlowActionConfirmation({
  runId,
  command,
  preview,
  step,
  isSubmitting,
  onConfirm,
  onCancel,
  onResolve,
}: FlowActionConfirmationProps) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const effectivePreview = useMemo(() => {
    if (step?.type === 'review') return step.preview;
    if (step?.type === 'confirm') return step.preview ?? preview;
    return preview;
  }, [preview, step]);

  const hasFillMissingValues = step?.type === 'fill_missing'
    ? step.fields.every((field) => {
      if (!field.required) return true;
      const value = fieldValues[field.name];
      return typeof value === 'string' && value.trim().length > 0;
    })
    : true;

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-zinc-900 p-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-wider text-amber-300">Confirmacao necessaria</p>
        <h3 className="text-sm font-semibold text-zinc-100 mt-1">{effectivePreview?.title ?? command}</h3>
        <p className="text-xs text-zinc-400 mt-1">
          {effectivePreview?.summary ?? 'Revise os dados antes de confirmar.'}
        </p>
        {step?.type === 'confirm' ? (
          <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs text-red-200">
            {step.warning}
          </p>
        ) : null}
      </div>

      {effectivePreview?.details?.length ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-1">
          {effectivePreview.details.map((detail) => (
            <div key={`${detail.label}-${detail.value}`} className="text-xs text-zinc-300">
              <span className="text-zinc-500">{detail.label}:</span> {detail.value}
            </div>
          ))}
        </div>
      ) : null}

      {step?.type === 'disambiguate' ? (
        <div className="space-y-2">
          <p className="text-xs text-zinc-300">Selecione uma opcao para continuar:</p>
          <div className="space-y-2">
            {step.options.map((option) => (
              <button
                key={`${step.field}-${option.id}`}
                type="button"
                disabled={isSubmitting || !onResolve}
                onClick={() => {
                  if (!onResolve) return;
                  void onResolve(runId, { [step.field]: option.id });
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-xs text-zinc-200 hover:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="font-medium">{option.label}</p>
                {option.detail ? <p className="text-zinc-400 mt-1">{option.detail}</p> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step?.type === 'fill_missing' ? (
        <div className="space-y-3">
          <p className="text-xs text-zinc-300">Preencha os campos obrigatorios:</p>
          <div className="space-y-2">
            {step.fields.map((field) => (
              <div key={field.name}>
                <label htmlFor={`flow-step-${field.name}`} className="mb-1 block text-[11px] text-zinc-500">
                  {field.label}
                </label>
                <input
                  id={`flow-step-${field.name}`}
                  type="text"
                  value={fieldValues[field.name] ?? ''}
                  onChange={(event) => {
                    setFieldValues((current) => ({ ...current, [field.name]: event.target.value }));
                  }}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-sky-500 focus:outline-none disabled:opacity-60"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={isSubmitting || !onResolve || !hasFillMissingValues}
            onClick={() => {
              if (!onResolve || step.type !== 'fill_missing') return;
              const payload = Object.fromEntries(
                step.fields.map((field) => [field.name, castFieldValue(field.type, fieldValues[field.name] ?? '')]),
              );
              void onResolve(runId, payload);
            }}
            className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-sky-950 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continuar
          </button>
        </div>
      ) : null}

      {step?.type !== 'disambiguate' && step?.type !== 'fill_missing' ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onConfirm(runId)}
            disabled={isSubmitting}
            className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
              step?.type === 'confirm'
                ? 'bg-red-500 text-red-50 hover:bg-red-400'
                : 'bg-sky-500 text-sky-950 hover:bg-sky-400'
            }`}
          >
            {step?.type === 'confirm' ? step.action : 'Confirmar'}
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
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onCancel(runId)}
            disabled={isSubmitting}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

