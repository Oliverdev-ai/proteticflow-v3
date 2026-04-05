import { formatCurrency, formatDate, type Nfse } from '@proteticflow/shared';

type NfseListProps = {
  notas: Nfse[];
  isBusy?: boolean;
  onSync: (nfseId: number) => void;
  onCancel: (nfseId: number) => void;
};

const STATUS_LABELS: Record<Nfse['status'], string> = {
  draft: 'Rascunho',
  pending: 'Pendente',
  issued: 'Emitida',
  cancelled: 'Cancelada',
  error: 'Erro',
};

const STATUS_CLASSNAMES: Record<Nfse['status'], string> = {
  draft: 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/30',
  pending: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  issued: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  cancelled: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  error: 'bg-red-500/15 text-red-300 border border-red-500/30',
};

export function NfseList({ notas, isBusy = false, onSync, onCancel }: NfseListProps) {
  if (notas.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
        Nenhuma nota fiscal encontrada para os filtros atuais.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-950/70 border-b border-zinc-800 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3 text-left">ID</th>
            <th className="px-4 py-3 text-left">Tomador</th>
            <th className="px-4 py-3 text-left">Valor</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Emissao</th>
            <th className="px-4 py-3 text-left">Acoes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {notas.map((nota) => (
            <tr key={nota.id}>
              <td className="px-4 py-3 text-zinc-200">#{nota.id}</td>
              <td className="px-4 py-3 text-zinc-200">{nota.tomadorName}</td>
              <td className="px-4 py-3 text-zinc-200">{formatCurrency(nota.grossValueCents)}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs ${STATUS_CLASSNAMES[nota.status]}`}>
                  {STATUS_LABELS[nota.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-300">{nota.issuedAt ? formatDate(nota.issuedAt) : '-'}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSync(nota.id)}
                    disabled={isBusy}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 disabled:opacity-50"
                  >
                    Sincronizar
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancel(nota.id)}
                    disabled={isBusy || nota.status !== 'issued'}
                    className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-xs text-white disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!nota.danfseUrl) return;
                      window.open(nota.danfseUrl, '_blank', 'noopener,noreferrer');
                    }}
                    disabled={isBusy || !nota.danfseUrl}
                    className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-xs text-white disabled:opacity-50"
                  >
                    Abrir DANFSE
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
