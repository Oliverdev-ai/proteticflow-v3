import { useMemo, useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { NfseEmitForm } from '../../../components/fiscal/nfse-emit-form';
import { NfseBatchModal } from '../../../components/fiscal/nfse-batch-modal';
import { NfseList } from '../../../components/fiscal/nfse-list';
import { PageTitle, H2 } from '../../../components/shared/typography';
import { Button } from '../../../components/ui/button';

function toIso(date: string, endOfDay: boolean): string | undefined {
  if (!date) return undefined;
  const suffix = endOfDay ? '23:59:59' : '00:00:00';
  return new Date(`${date}T${suffix}`).toISOString();
}

export default function NotasFiscaisPage() {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<'draft' | 'pending' | 'issued' | 'cancelled' | 'error' | ''>(
    '',
  );
  const [clientId, setClientId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cancelNfseId, setCancelNfseId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

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
      setCancelNfseId(null);
      setCancelReason('');
      setCancelError('');
      await utils.fiscal.listNfse.invalidate();
    },
    onError: (error) => {
      setCancelError(error.message);
    },
  });

  const clients = clientsQuery.data?.data ?? [];
  const closings = closingsQuery.data?.data ?? [];
  const busy =
    emitMutation.isPending ||
    emitBatchMutation.isPending ||
    syncMutation.isPending ||
    cancelMutation.isPending;

  function openCancelModal(nfseId: number) {
    setCancelError('');
    setCancelReason('');
    setCancelNfseId(nfseId);
  }

  function closeCancelModal() {
    if (cancelMutation.isPending) return;
    setCancelError('');
    setCancelReason('');
    setCancelNfseId(null);
  }

  function submitCancelNfse() {
    if (cancelNfseId === null) return;
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError('Informe o motivo do cancelamento.');
      return;
    }
    cancelMutation.mutate({ nfseId: cancelNfseId, reason });
  }

  return (
    <div className="space-y-6">
      <PageTitle subtitle="Emissão, acompanhamento e cancelamento de NFS-e.">
        Fiscal - Notas Fiscais
      </PageTitle>

      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 space-y-4">
        <H2>Filtros</H2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="t-small text-[var(--fg-muted)]">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="input-field mt-1 w-full"
            >
              <option value="">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="pending">Pendente</option>
              <option value="issued">Emitida</option>
              <option value="cancelled">Cancelada</option>
              <option value="error">Erro</option>
            </select>
          </label>

          <label className="t-small text-[var(--fg-muted)]">
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

          <label className="t-small text-[var(--fg-muted)]">
            De
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="input-field mt-1 w-full"
            />
          </label>

          <label className="t-small text-[var(--fg-muted)]">
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
        onCancel={openCancelModal}
      />

      {cancelNfseId !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-lg)]">
            <h3 className="font-[var(--font-display)] text-xl text-[var(--fg-strong)]">
              Cancelar NFS-e #{cancelNfseId}
            </h3>
            <p className="mt-1 t-small text-[var(--fg-muted)]">
              Informe o motivo do cancelamento para auditoria.
            </p>

            <label className="mt-4 block space-y-1.5">
              <span className="t-small text-[var(--fg-muted)]">Motivo do cancelamento</span>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={4}
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                placeholder="Descreva o motivo"
              />
            </label>

            {cancelError ? <p className="mt-2 t-small text-[var(--destructive)]">{cancelError}</p> : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeCancelModal} disabled={cancelMutation.isPending}>
                Voltar
              </Button>
              <Button type="button" variant="destructive" onClick={submitCancelNfse} loading={cancelMutation.isPending}>
                Confirmar cancelamento
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
