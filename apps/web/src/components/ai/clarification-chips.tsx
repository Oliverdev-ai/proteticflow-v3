type ClarificationOption = {
  id: number;
  label: string;
  detail?: string;
};

type ClarificationChipsProps = {
  candidates: ClarificationOption[];
  disabled?: boolean;
  onSelect: (option: ClarificationOption) => void;
};

export function ClarificationChips({ candidates, disabled, onSelect }: ClarificationChipsProps) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <div data-clarification className="rounded-xl border border-border bg-muted p-3 space-y-3">
      <p className="text-xs text-muted-foreground">Selecione o item correto para continuar:</p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((candidate) => (
          <button
            key={`${candidate.id}-${candidate.label}`}
            type="button"
            data-chip={candidate.label}
            disabled={disabled}
            onClick={() => onSelect(candidate)}
            className="rounded-full border border-[var(--info)] bg-[var(--info-soft)] px-3 py-1.5 text-xs text-[var(--info)] hover:bg-[var(--info-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {candidate.label}
          </button>
        ))}
      </div>
      {candidates.some((candidate) => candidate.detail) ? (
        <div className="space-y-1">
          {candidates.map((candidate) => (
            candidate.detail ? (
              <p key={`detail-${candidate.id}`} className="text-[11px] text-muted-foreground">
                {candidate.label}: {candidate.detail}
              </p>
            ) : null
          ))}
        </div>
      ) : null}
    </div>
  );
}
