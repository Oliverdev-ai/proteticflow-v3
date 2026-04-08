import { useMemo, useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { BoletoList } from '../../../components/fiscal/boleto-list';

function toIso(date: string, endOfDay: boolean): string | undefined {
  if (!date) return undefined;
  const suffix = endOfDay ? '23:59:59' : '00:00:00';
  return new Date(`${date}T${suffix}`).toISOString();
}

export default function BoletosPage() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<
    'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded' | ''
  >('');
  const [clientId, setClientId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [manualClientId, setManualClientId] = useState<number | null>(null);
  const [manualAmount, setManualAmount] = useState('0');
  const [manualDueDate, setManualDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualDescription, setManualDescription] = useState('');
  const [arIdToGenerate, setArIdToGenerate] = useState('');

  const clientsQuery = trpc.clientes.list.useQuery({ page: 1, limit: 100 });

  const boletoFilters = useMemo(() => {
    const filters: {
      status?: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
      clientId?: number;
      dateFrom?: string;
      dateTo?: string;
      limit: number;
    } = { limit: 50 };

    if (status) filters.status = status;
    if (clientId) filters.clientId = clientId;

    const isoFrom = toIso(dateFrom, false);
    const isoTo = toIso(dateTo, true);
    if (isoFrom) filters.dateFrom = isoFrom;
    if (isoTo) filters.dateTo = isoTo;

    return filters;
  }, [status, clientId, dateFrom, dateTo]);

  const boletosQuery = trpc.fiscal.listBoletos.useQuery(boletoFilters);

  const generateFromArMutation = trpc.fiscal.generateBoletoFromAr.useMutation({
    onSuccess: async () => {
      await utils.fiscal.listBoletos.invalidate();
    },
  });

  const generateManualMutation = trpc.fiscal.generateBoletoManual.useMutation({
    onSuccess: async () => {
      await utils.fiscal.listBoletos.invalidate();
    },
  });

  const syncMutation = trpc.fiscal.syncBoletoStatus.useMutation({
    onSuccess: async () => {
      await utils.fiscal.listBoletos.invalidate();
    },
  });

  const cancelMutation = trpc.fiscal.cancelBoleto.useMutation({
    onSuccess: async () => {
      await utils.fiscal.listBoletos.invalidate();
    },
  });

  async function handleGenerateFromAr(): Promise<void> {
    if (!arIdToGenerate) return;
    await generateFromArMutation.mutateAsync({ arId: Number(arIdToGenerate) });
    setArIdToGenerate('');
  }

  async function handleGenerateManual(): Promise<void> {
    if (!manualClientId) return;
    const amountValue = Number(manualAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) return;

    const payload: {
      clientId: number;
      amountCents: number;
      dueDate: string;
      description?: string;
    } = {
      clientId: manualClientId,
      amountCents: Math.round(amountValue * 100),
      dueDate: new Date(`${manualDueDate}T12:00:00`).toISOString(),
    };

    if (manualDescription.trim().length > 0) {
      payload.description = manualDescription.trim();
    }

    await generateManualMutation.mutateAsync(payload);
  }

  const clients = clientsQuery.data?.data ?? [];
  const busy =
    generateFromArMutation.isPending ||
    generateManualMutation.isPending ||
    syncMutation.isPending ||
    cancelMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Fiscal - Boletos</h1>
        <p className="text-sm text-zinc-400">Geração, consulta e cancelamento de boletos.</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-sm text-zinc-300">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="input-field mt-1 w-full"
            >
              <option value="">Todos</option>
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="overdue">Vencido</option>
              <option value="cancelled">Cancelado</option>
              <option value="refunded">Estornado</option>
            </select>
          </label>

          <label className="text-sm text-zinc-300">
            Cliente
            <select
              value={clientId ?? ''}
              onChange={(event) =>
                setClientId(event.target.value ? Number(event.target.value) : null)
              }
              className="input-field mt-1 w-full"
            >
              <option value="">Todos</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-zinc-300">
            De
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="input-field mt-1 w-full"
            />
          </label>

          <label className="text-sm text-zinc-300">
            Ate
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="input-field mt-1 w-full"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h2 className="text-lg font-semibold text-white">Gerar por AR</h2>
          <label className="text-sm text-zinc-300 block">
            ID da conta a receber
            <input
              type="number"
              min="1"
              value={arIdToGenerate}
              onChange={(event) => setArIdToGenerate(event.target.value)}
              className="input-field mt-1 w-full"
            />
          </label>
          <button
            type="button"
            onClick={handleGenerateFromAr}
            disabled={busy || !arIdToGenerate}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary text-white text-sm font-medium disabled:opacity-50"
          >
            Gerar boleto da AR
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <h2 className="text-lg font-semibold text-white">Gerar boleto manual</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="text-sm text-zinc-300">
              Cliente
              <select
                value={manualClientId ?? ''}
                onChange={(event) =>
                  setManualClientId(event.target.value ? Number(event.target.value) : null)
                }
                className="input-field mt-1 w-full"
              >
                <option value="">Selecione</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-zinc-300">
              Valor (R$)
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualAmount}
                onChange={(event) => setManualAmount(event.target.value)}
                className="input-field mt-1 w-full"
              />
            </label>

            <label className="text-sm text-zinc-300">
              Vencimento
              <input
                type="date"
                value={manualDueDate}
                onChange={(event) => setManualDueDate(event.target.value)}
                className="input-field mt-1 w-full"
              />
            </label>

            <label className="text-sm text-zinc-300">
              Descricao
              <input
                type="text"
                value={manualDescription}
                onChange={(event) => setManualDescription(event.target.value)}
                className="input-field mt-1 w-full"
                placeholder="Opcional"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={handleGenerateManual}
            disabled={busy || !manualClientId}
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
          >
            Gerar boleto manual
          </button>
        </div>
      </div>

      <BoletoList
        boletos={boletosQuery.data?.data ?? []}
        isBusy={busy}
        onSync={(boletoId) => syncMutation.mutate({ boletoId })}
        onCancel={(boletoId) => cancelMutation.mutate({ boletoId })}
      />
    </div>
  );
}
