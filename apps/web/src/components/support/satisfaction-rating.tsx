import { useState } from 'react';
import { Star } from 'lucide-react';

type SatisfactionRatingProps = {
  disabled?: boolean;
  onRate: (score: number) => Promise<void>;
};

export function SatisfactionRating({ disabled, onRate }: SatisfactionRatingProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-border bg-muted p-3">
      <p className="text-xs text-muted-foreground mb-2">Como foi seu atendimento?</p>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            disabled={disabled}
            onClick={async () => {
              setSelected(score);
              await onRate(score);
            }}
            className={`h-8 w-8 rounded-full border text-sm ${
              selected !== null && score <= selected
                ? 'bg-[var(--warning-soft)] border-[var(--warning)] text-black'
                : 'border-border text-muted-foreground hover:border-[var(--warning)]'
            } disabled:opacity-50`}
          >
            <Star size={14} className="mx-auto" />
            <span className="sr-only">{`Avaliação ${score}`}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
