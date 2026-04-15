import { useMemo, useState } from 'react';
import { trpc } from '../../../lib/trpc';

type SuggestionCategory = 'product' | 'ux' | 'performance' | 'financial' | 'support' | 'other';
type SuggestionImpact = 'low' | 'medium' | 'high';

const CATEGORY_LABEL: Record<SuggestionCategory, string> = {
  product: 'Produto',
  ux: 'UX',
  performance: 'Performance',
  financial: 'Financeiro',
  support: 'Suporte',
  other: 'Outro',
};

const IMPACT_LABEL: Record<SuggestionImpact, string> = {
  low: 'Baixo',
  medium: 'Medio',
  high: 'Alto',
};

const STATUS_LABEL: Record<'received' | 'reviewing' | 'implemented' | 'rejected', string> = {
  received: 'Recebida',
  reviewing: 'Em analise',
  implemented: 'Implementada',
  rejected: 'Nao priorizada',
};

export default function SupportSuggestionsPage() {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SuggestionCategory>('product');
  const [perceivedImpact, setPerceivedImpact] = useState<SuggestionImpact>('medium');

  const suggestionsQuery = trpc.support.listSuggestions.useQuery({ limit: 50 });
  const createSuggestionMutation = trpc.support.createSuggestion.useMutation({
    onSuccess: async () => {
      setTitle('');
      setDescription('');
      setCategory('product');
      setPerceivedImpact('medium');
      await utils.support.listSuggestions.invalidate();
    },
  });

  const suggestions = useMemo(() => suggestionsQuery.data?.data ?? [], [suggestionsQuery.data?.data]);
  const busy = createSuggestionMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Suporte • Sugestoes</h1>
        <p className="text-sm text-zinc-400">
          Envie melhorias para o produto e acompanhe o status das sugestoes do laboratorio.
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Nova sugestao</h2>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Titulo da sugestao"
          className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
        />
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Descreva a melhoria sugerida"
          className="w-full min-h-[110px] rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as SuggestionCategory)}
            className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
          >
            {(Object.keys(CATEGORY_LABEL) as SuggestionCategory[]).map((value) => (
              <option key={value} value={value}>{CATEGORY_LABEL[value]}</option>
            ))}
          </select>
          <select
            value={perceivedImpact}
            onChange={(event) => setPerceivedImpact(event.target.value as SuggestionImpact)}
            className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
          >
            {(Object.keys(IMPACT_LABEL) as SuggestionImpact[]).map((value) => (
              <option key={value} value={value}>{IMPACT_LABEL[value]}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy || title.trim().length < 3 || description.trim().length < 10}
          onClick={async () => {
            await createSuggestionMutation.mutateAsync({
              title: title.trim(),
              description: description.trim(),
              category,
              perceivedImpact,
            });
          }}
          className="px-4 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-sm disabled:opacity-50"
        >
          {busy ? 'Enviando...' : 'Enviar sugestao'}
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Sugestoes enviadas</h2>

        {suggestionsQuery.isLoading && <p className="text-sm text-zinc-400">Carregando sugestoes...</p>}
        {suggestionsQuery.error && (
          <p className="text-sm text-red-400">Erro ao carregar sugestoes: {suggestionsQuery.error.message}</p>
        )}
        {!suggestionsQuery.isLoading && !suggestionsQuery.error && suggestions.length === 0 && (
          <p className="text-sm text-zinc-400">Nenhuma sugestao enviada ate agora.</p>
        )}

        {!suggestionsQuery.isLoading && !suggestionsQuery.error && suggestions.length > 0 && (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <article key={suggestion.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">{suggestion.title}</h3>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400">
                    {STATUS_LABEL[suggestion.status]}
                  </span>
                </div>
                <p className="text-sm text-zinc-300">{suggestion.description}</p>
                <p className="text-xs text-zinc-500">
                  Categoria: {CATEGORY_LABEL[suggestion.category as SuggestionCategory]} • Impacto: {IMPACT_LABEL[suggestion.perceivedImpact as SuggestionImpact]}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
