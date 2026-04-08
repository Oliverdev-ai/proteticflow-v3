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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-zinc-500">Transcricao por voz</p>
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
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-sky-500 focus:outline-none disabled:opacity-60"
      />

      <div className="flex items-center gap-2">
        <button
          id="flow-transcript-send"
          type="button"
          onClick={() => void onSend()}
          disabled={disabled || text.trim().length === 0}
          className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-sky-950 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enviar
        </button>
        <button
          id="flow-transcript-discard"
          type="button"
          onClick={onDiscard}
          disabled={disabled}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

