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
    <div className="rounded-2xl border border-cyan-700/40 bg-cyan-900/20 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-cyan-300">Sugestões proativas</p>
          <p className="text-sm text-cyan-100">O Flow IA detectou pontos de atenção no laboratório.</p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs text-cyan-300 hover:text-cyan-100"
        >
          Dispensar
        </button>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="rounded-xl border border-cyan-700/40 px-3 py-2">
            <p className="text-sm text-cyan-100">{suggestion.text}</p>
            <button
              type="button"
              onClick={() => void onAction(suggestion.prompt)}
              className="mt-2 text-xs text-cyan-200 hover:text-white"
            >
              {suggestion.actionLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
