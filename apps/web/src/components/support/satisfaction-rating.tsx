import { useState } from 'react';

type SatisfactionRatingProps = {
  disabled?: boolean;
  onRate: (score: number) => Promise<void>;
};

export function SatisfactionRating({ disabled, onRate }: SatisfactionRatingProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
      <p className="text-xs text-neutral-400 mb-2">Como foi seu atendimento?</p>
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
                ? 'bg-yellow-500 border-yellow-400 text-black'
                : 'border-neutral-600 text-neutral-300 hover:border-yellow-400'
            } disabled:opacity-50`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
