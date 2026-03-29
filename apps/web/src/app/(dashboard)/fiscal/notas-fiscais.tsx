import { useMemo, useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { NfseEmitForm } from '../../../components/fiscal/nfse-emit-form';
import { NfseBatchModal } from '../../../components/fiscal/nfse-batch-modal';
import { NfseList } from '../../../components/fiscal/nfse-list';

function toIso(date: string, endOfDay: boolean): string | undefined {
  if (!date) return undefined;
  const suffix = endOfDay ? '23:59:59' : '00:00:00';
  return new Date(`${date}T${suffix}`).toISOString();
}

export default function NotasFiscaisPage() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<'draft' | 'pending' | 'issued' | 'cancelled' | 'error' | ''>('');
  const [clientId, setClientId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const clientsQuery = trpc.clientes.list.useQuery({ page: 1, limit: 100 });
  const closingsQuery = trpc.financial.listClosings.useQuery({ page: 1, limit: 100 });

  const nfseFilters = useMemo(() => {
    const filters: {
      status?: 'draft' | 'pending' | 'issued' | 'cancelled' | 'error';
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

  const nfseQuery = trpc.fiscal.listNfse.useQuery(nfseFilters);

  const emitMutation = trpc.fiscal.emitNfse.useMutation({
    onSuccess: async () => {
      await utils.fiscal.listNfse.invalidate();
    },
  });

  const emitBatchMutation = trpc.fiscal.emitNfseInBatch.useMutation({
    onSuccess: async () => {
      await utils.fiscal.listNfse.invalidate();
    },
  });

  const syncMutation = trpc.fiscal.syncNfseStatus.useMutation({
    onSuccess: async () => {
      await utils.fiscal.listNfse.invalidate();
    },
  });

  const cancelMutation = trpc.fiscal.cancelNfse.useMutation({
    onSuccess: async () => {
      await utils.fiscal.listNfse.invalidate();
    },
  });

  const clients = clientsQuery.data?.data ?? [];
  const closings = closingsQuery.data?.data ?? [];
  const busy = emitMutation.isPending || emitBatchMutation.isPending || syncMutation.isPending || cancelMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Fiscal - Notas Fiscais</h1>
        <p className="text-sm text-neutral-400">Emissao, acompanhamento e cancelamento de NFS-e.</p>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white">Filtros</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-sm text-neutral-300">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="input-field mt-1 w-full">
              <option value="">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="pending">Pendente</option>
              <option value="issued">Emitida</option>
              <option value="cancelled">Cancelada</option>
              <option value="error">Erro</option>
            </select>
          </label>

          <label className="text-sm text-neutral-300">
            Cliente
            <select
              value={clientId ?? ''}
              onChange={(event) => setClientId(event.target.value ? Number(event.target.value) : null)}
              className="input-field mt-1 w-full"
            >
              <option value="">Todos</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </label>

          <label className="text-sm text-neutral-300">
            De
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="input-field mt-1 w-full" />
          </label>

          <label className="text-sm text-neutral-300">
            Ate
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="input-field mt-1 w-full" />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <NfseEmitForm
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          isBusy={busy}
          onEmit={async (input) => {
            await emitMutation.mutateAsync(input);
          }}
        />

        <NfseBatchModal
          closings={closings.map((closing) => ({
            id: closing.id,
            period: closing.period,
            totalAmountCents: closing.totalAmountCents,
            status: closing.status,
          }))}
          isBusy={busy}
          onEmitBatch={async (closingId) => {
            await emitBatchMutation.mutateAsync({ closingId });
          }}
        />
      </div>

      <NfseList
        notas={nfseQuery.data?.data ?? []}
        isBusy={busy}
        onSync={(nfseId) => syncMutation.mutate({ nfseId })}
        onCancel={(nfseId) => {
          const reason = window.prompt('Motivo do cancelamento da NFS-e:');
          if (!reason) return;
          cancelMutation.mutate({ nfseId, reason });
        }}
      />
    </div>
  );
}
