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
    <div className="rounded-lg border border-amber-500/40 bg-muted p-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-normal text-amber-300">Confirmacao necessaria</p>
        <h3 className="text-sm font-semibold text-muted-foreground mt-1">{effectivePreview?.title ?? command}</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {effectivePreview?.summary ?? 'Revise os dados antes de confirmar.'}
        </p>
        {step?.type === 'confirm' ? (
          <p className="mt-2 rounded-lg border border-[var(--destructive)] bg-[var(--destructive-soft)] px-2 py-1 text-xs text-[var(--destructive)]">
            {step.warning}
          </p>
        ) : null}
      </div>

      {effectivePreview?.details?.length ? (
        <div className="rounded-lg border border-border bg-muted p-3 space-y-1">
          {effectivePreview.details.map((detail) => (
            <div key={`${detail.label}-${detail.value}`} className="text-xs text-muted-foreground">
              <span className="text-muted-foreground">{detail.label}:</span> {detail.value}
            </div>
          ))}
        </div>
      ) : null}

      {step?.type === 'disambiguate' ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Selecione uma opcao para continuar:</p>
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
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-left text-xs text-muted-foreground hover:border-[var(--info)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <p className="font-medium">{option.label}</p>
                {option.detail ? <p className="text-muted-foreground mt-1">{option.detail}</p> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step?.type === 'fill_missing' ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Preencha os campos obrigatorios:</p>
          <div className="space-y-2">
            {step.fields.map((field) => (
              <div key={field.name}>
                <label htmlFor={`flow-step-${field.name}`} className="mb-1 block text-[11px] text-muted-foreground">
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
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground focus:border-[var(--info)] focus:outline-none disabled:opacity-60"
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
            className="rounded-lg bg-[var(--info-soft)] px-3 py-2 text-sm font-medium text-[var(--info)] hover:bg-[var(--info-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
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
                ? 'bg-[var(--destructive-soft)] text-[var(--destructive)] hover:bg-[var(--destructive-soft)]'
                : 'bg-[var(--info-soft)] text-[var(--info)] hover:bg-[var(--info-soft)]'
            }`}
          >
            {step?.type === 'confirm' ? step.action : 'Confirmar'}
          </button>
          <button
            type="button"
            onClick={() => void onCancel(runId)}
            disabled={isSubmitting}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:border-border disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:border-border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

