import { useMemo, useState } from 'react';
import { formatCurrency } from '@proteticflow/shared';

type ClosingOption = {
  id: number;
  period: string;
  totalAmountCents: number;
  status: string;
};

type NfseBatchModalProps = {
  closings: ClosingOption[];
  isBusy?: boolean;
  onEmitBatch: (closingId: number) => Promise<void>;
};

export function NfseBatchModal({ closings, isBusy = false, onEmitBatch }: NfseBatchModalProps) {
  const [selectedClosingId, setSelectedClosingId] = useState<number | null>(closings[0]?.id ?? null);

  const selectedClosing = useMemo(
    () => closings.find((item) => item.id === selectedClosingId) ?? null,
    [closings, selectedClosingId],
  );

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
      <h2 className="text-lg font-semibold text-white">Emissao em lote por fechamento</h2>
      <p className="text-sm text-zinc-400">Emite 1 NFS-e por cliente para o fechamento selecionado.</p>

      <label className="text-sm text-zinc-300 block">
        Fechamento
        <select
          value={selectedClosingId ?? ''}
          onChange={(event) => setSelectedClosingId(event.target.value ? Number(event.target.value) : null)}
          className="input-field mt-1 w-full"
        >
          <option value="">Selecione</option>
          {closings.map((closing) => (
            <option key={closing.id} value={closing.id}>
              #{closing.id} - {closing.period} - {closing.status}
            </option>
          ))}
        </select>
      </label>

      {selectedClosing ? (
        <p className="text-sm text-zinc-300">
          Total do fechamento: <span className="text-zinc-100">{formatCurrency(selectedClosing.totalAmountCents)}</span>
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => selectedClosingId && onEmitBatch(selectedClosingId)}
        disabled={isBusy || !selectedClosingId}
        className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
      >
        Emitir lote
      </button>
    </div>
  );
}
