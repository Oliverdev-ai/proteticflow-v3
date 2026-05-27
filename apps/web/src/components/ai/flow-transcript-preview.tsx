type FlowTranscriptPreviewProps = {
  text: string;
  confidence?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSend: () => Promise<void>;
  onDiscard: () => void;
};

export function FlowTranscriptPreview({
  text,
  confidence,
  disabled,
  onChange,
  onSend,
  onDiscard,
}: FlowTranscriptPreviewProps) {
  const shouldReview = confidence !== undefined && confidence < 0.8;

  return (
    <div className="rounded-lg border border-border bg-muted p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-normal text-muted-foreground">Transcricao por voz</p>
        {shouldReview ? (
          <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
            Revise a transcricao
          </span>
        ) : null}
      </div>

      <textarea
        id="flow-transcript-text"
        value={text}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        disabled={disabled}
        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground placeholder:text-muted-foreground focus:border-[var(--info)] focus:outline-none disabled:opacity-60"
      />

      <div className="flex items-center gap-2">
        <button
          id="flow-transcript-send"
          type="button"
          onClick={() => void onSend()}
          disabled={disabled || text.trim().length === 0}
          className="rounded-lg bg-[var(--info-soft)] px-3 py-2 text-sm font-medium text-[var(--info)] hover:bg-[var(--info-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enviar
        </button>
        <button
          id="flow-transcript-discard"
          type="button"
          onClick={onDiscard}
          disabled={disabled}
          className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:border-border disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

