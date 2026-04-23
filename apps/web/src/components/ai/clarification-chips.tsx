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
    <div data-clarification className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-3">
      <p className="text-xs text-zinc-300">Selecione o item correto para continuar:</p>
      <div className="flex flex-wrap gap-2">
        {candidates.map((candidate) => (
          <button
            key={`${candidate.id}-${candidate.label}`}
            type="button"
            data-chip={candidate.label}
            disabled={disabled}
            onClick={() => onSelect(candidate)}
            className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-100 hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {candidate.label}
          </button>
        ))}
      </div>
      {candidates.some((candidate) => candidate.detail) ? (
        <div className="space-y-1">
          {candidates.map((candidate) => (
            candidate.detail ? (
              <p key={`detail-${candidate.id}`} className="text-[11px] text-zinc-500">
                {candidate.label}: {candidate.detail}
              </p>
            ) : null
          ))}
        </div>
      ) : null}
    </div>
  );
}
