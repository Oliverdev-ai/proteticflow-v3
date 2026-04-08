import { formatCurrency, formatDate, type Boleto } from '@proteticflow/shared';
import { BoletoActions } from './boleto-actions';

type BoletoListProps = {
  boletos: Boleto[];
  isBusy?: boolean;
  onSync: (boletoId: number) => void;
  onCancel: (boletoId: number) => void;
};

const STATUS_LABELS: Record<Boleto['status'], string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Vencido',
  cancelled: 'Cancelado',
  refunded: 'Estornado',
};

const STATUS_CLASSNAMES: Record<Boleto['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  paid: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  overdue: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
  cancelled: 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/30',
  refunded: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
};

export function BoletoList({ boletos, isBusy = false, onSync, onCancel }: BoletoListProps) {
  if (boletos.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
        Nenhum boleto encontrado para os filtros atuais.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-950/70 border-b border-zinc-800 text-xs uppercase text-zinc-500">
          <tr>
            <th className="px-4 py-3 text-left">ID</th>
            <th className="px-4 py-3 text-left">Valor</th>
            <th className="px-4 py-3 text-left">Vencimento</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Acoes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {boletos.map((boleto) => (
            <tr key={boleto.id}>
              <td className="px-4 py-3 text-zinc-200">#{boleto.id}</td>
              <td className="px-4 py-3 text-zinc-200">{formatCurrency(boleto.amountCents)}</td>
              <td className="px-4 py-3 text-zinc-300">{formatDate(boleto.dueDate)}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs ${STATUS_CLASSNAMES[boleto.status]}`}>
                  {STATUS_LABELS[boleto.status]}
                </span>
              </td>
              <td className="px-4 py-3">
                <BoletoActions
                  boleto={boleto}
                  isBusy={isBusy}
                  onSync={onSync}
                  onCancel={onCancel}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
