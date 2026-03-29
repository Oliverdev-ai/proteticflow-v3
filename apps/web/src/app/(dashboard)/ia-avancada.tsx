import { trpc } from '../../lib/trpc';

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
}

function formatNumeric(value: string | number | null | undefined) {
  if (value === null || value === undefined) return '-';
  const parsed = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(parsed)) return String(value);
  return parsed.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

export default function IAAvancadaPage() {
  const utils = trpc.useUtils();

  const predictionsQuery = trpc.ai.listPredictions.useQuery({ limit: 20 });
  const recommendationsQuery = trpc.ai.listRecommendations.useQuery({ limit: 20 });
  const runsQuery = trpc.ai.listModelRuns.useQuery();

  const feedbackMutation = trpc.ai.recordFeedback.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ai.listRecommendations.invalidate(),
        utils.ai.listModelRuns.invalidate(),
      ]);
    },
  });

  async function handleFeedback(recommendationId: number, decision: 'accepted' | 'rejected') {
    await feedbackMutation.mutateAsync({ recommendationId, decision });
  }

  const predictions = predictionsQuery.data ?? [];
  const recommendations = recommendationsQuery.data ?? [];
  const runs = runsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">IA Avancada</h1>
        <p className="text-sm text-neutral-400">
          Predicoes, recomendacoes e execucoes de modelos por tenant.
        </p>
      </div>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <h2 className="text-white font-semibold">Predicoes</h2>
        {predictionsQuery.isLoading && <p className="text-sm text-neutral-400">Carregando predicoes...</p>}
        {predictionsQuery.error && (
          <p className="text-sm text-red-400">Erro ao carregar predicoes: {predictionsQuery.error.message}</p>
        )}
        {!predictionsQuery.isLoading && !predictionsQuery.error && predictions.length === 0 && (
          <p className="text-sm text-neutral-400">Nenhuma predicao encontrada.</p>
        )}
        {!predictionsQuery.isLoading && !predictionsQuery.error && predictions.length > 0 && (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-400">
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2 pr-4">Confianca</th>
                  <th className="py-2 pr-4">Periodo</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((row) => (
                  <tr key={row.prediction.id} className="border-t border-neutral-800 text-neutral-200">
                    <td className="py-2 pr-4">{row.prediction.predictionType}</td>
                    <td className="py-2 pr-4">
                      {formatNumeric(row.prediction.predictedValue)} {row.prediction.unit}
                    </td>
                    <td className="py-2 pr-4">{formatNumeric(row.prediction.confidenceScore)}</td>
                    <td className="py-2 pr-4">
                      {formatDateTime(row.prediction.generatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <h2 className="text-white font-semibold">Recomendacoes</h2>
        {recommendationsQuery.isLoading && <p className="text-sm text-neutral-400">Carregando recomendacoes...</p>}
        {recommendationsQuery.error && (
          <p className="text-sm text-red-400">Erro ao carregar recomendacoes: {recommendationsQuery.error.message}</p>
        )}
        {!recommendationsQuery.isLoading && !recommendationsQuery.error && recommendations.length === 0 && (
          <p className="text-sm text-neutral-400">Nenhuma recomendacao encontrada.</p>
        )}
        {!recommendationsQuery.isLoading && !recommendationsQuery.error && recommendations.length > 0 && (
          <div className="space-y-3">
            {recommendations.map((row) => (
              <article
                key={row.recommendation.id}
                className="border border-neutral-800 rounded-lg p-3 space-y-2 bg-neutral-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">{row.recommendation.recommendationType}</h3>
                  <span className="text-xs text-neutral-400">status: {row.recommendation.status}</span>
                </div>
                <p className="text-sm text-neutral-300">{row.recommendation.rationale ?? 'Sem racional detalhado.'}</p>
                <p className="text-xs text-neutral-400">
                  prioridade: {formatNumeric(row.recommendation.priorityScore)} | confianca: {formatNumeric(row.recommendation.confidenceScore)}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-500 disabled:opacity-50"
                    disabled={feedbackMutation.isPending || row.recommendation.status !== 'suggested'}
                    onClick={() => handleFeedback(row.recommendation.id, 'accepted')}
                  >
                    Aceitar
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded bg-rose-600 text-white text-xs hover:bg-rose-500 disabled:opacity-50"
                    disabled={feedbackMutation.isPending || row.recommendation.status !== 'suggested'}
                    onClick={() => handleFeedback(row.recommendation.id, 'rejected')}
                  >
                    Rejeitar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
        <h2 className="text-white font-semibold">Runs de Modelo</h2>
        {runsQuery.isLoading && <p className="text-sm text-neutral-400">Carregando runs...</p>}
        {runsQuery.error && <p className="text-sm text-red-400">Erro ao carregar runs: {runsQuery.error.message}</p>}
        {!runsQuery.isLoading && !runsQuery.error && runs.length === 0 && (
          <p className="text-sm text-neutral-400">Nenhum run de modelo encontrado.</p>
        )}
        {!runsQuery.isLoading && !runsQuery.error && runs.length > 0 && (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-400">
                  <th className="py-2 pr-4">Dominio</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Duracao</th>
                  <th className="py-2 pr-4">Pred./Recs</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-neutral-800 text-neutral-200">
                    <td className="py-2 pr-4">{run.domain}</td>
                    <td className="py-2 pr-4">{run.status}</td>
                    <td className="py-2 pr-4">
                      {run.startedAt && run.finishedAt
                        ? `${Math.max(0, Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000))}s`
                        : '-'}
                    </td>
                    <td className="py-2 pr-4">
                      {formatNumeric((run.metricsJson as { predictionsCreated?: number } | null)?.predictionsCreated ?? 0)}
                      {' / '}
                      {formatNumeric((run.metricsJson as { recommendationsCreated?: number } | null)?.recommendationsCreated ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
