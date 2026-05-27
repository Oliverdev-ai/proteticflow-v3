import { useMemo, useState } from 'react';
import type { AiLabContext } from '@proteticflow/shared';

type ProactiveBannerProps = {
  context: AiLabContext | null | undefined;
  onAction: (prompt: string) => Promise<void>;
};

type Suggestion = {
  id: string;
  text: string;
  actionLabel: string;
  prompt: string;
};

export function ProactiveBanner({ context, onAction }: ProactiveBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!context) return [];

    const items: Suggestion[] = [];
    if (context.criticalStock > 0) {
      items.push({
        id: 'critical-stock',
        text: `Você tem ${context.criticalStock} materiais em estoque crítico.`,
        actionLabel: 'Ver estoque crítico',
        prompt: 'Mostrar materiais com estoque crítico',
      });
    }

    const overdueJobs = context.jobsByStatus.overdue ?? 0;
    if (overdueJobs > 0) {
      items.push({
        id: 'overdue-jobs',
        text: `${overdueJobs} trabalhos estão atrasados.`,
        actionLabel: 'Listar atrasados',
        prompt: 'Listar trabalhos atrasados',
      });
    }

    if (context.deliveriesToday > 0) {
      items.push({
        id: 'deliveries-today',
        text: `${context.deliveriesToday} entregas programadas para hoje.`,
        actionLabel: 'Ver entregas',
        prompt: 'Listar entregas de hoje',
      });
    }

    return items;
  }, [context]);

  if (dismissed || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[var(--info)] bg-[var(--info-soft)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-normal text-[var(--info)]">Sugestões proativas</p>
          <p className="text-sm text-[var(--info)]">O Flow IA detectou pontos de atenção no laboratório.</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-[var(--info)] hover:text-[var(--info)]"
        >
          Dispensar
        </button>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="rounded-xl border border-[var(--info)] px-3 py-2">
            <p className="text-sm text-[var(--info)]">{suggestion.text}</p>
            <button
              type="button"
              onClick={() => void onAction(suggestion.prompt)}
              className="mt-2 text-xs text-[var(--info)] hover:text-white"
            >
              {suggestion.actionLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
