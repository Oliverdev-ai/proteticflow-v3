import { useMemo, useState } from 'react';
import { Calendar, Loader2, MapPin, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DELIVERY_STATUS_CHIP } from '@proteticflow/shared';
import { trpc } from '../../../lib/trpc';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
import { PageTitle } from '../../../components/shared/typography';
import { FilterBar } from '../../../components/shared/filter-bar';
import { DataTable, type Column } from '../../../components/shared/data-table';
import { StatusChip } from '../../../components/shared/status-chip';

type DeliveryStatus = keyof typeof DELIVERY_STATUS_CHIP;

type DeliveryRow = {
  id: number;
  date: string;
  driverName: string | null;
  vehicle: string | null;
  itemCount: number;
  status: DeliveryStatus;
};

type PickupStopForm = {
  tempId: string;
  clientId: string;
  deliveryAddress: string;
  notes: string;
};

function toDeliveryStatus(value: string): DeliveryStatus {
  if (value === 'in_transit' || value === 'delivered' || value === 'failed') {
    return value;
  }
  return 'scheduled';
}

function buildClientAddress(client: {
  street?: string | null;
  addressNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  const parts = [client.street, client.addressNumber, client.neighborhood, client.city, client.state]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.join(', ');
}

function getCurrentWeekRange() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    from: monday,
    to: sunday,
  };
}

function createEmptyForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    driverName: '',
    vehicle: '',
    notes: '',
    selectedJobIds: [] as number[],
    deliveryAddressByJobId: {} as Record<number, string>,
    pickupStops: [] as PickupStopForm[],
  };
}

export default function DeliveryListPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { from, to } = getCurrentWeekRange();

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(from.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(to.toISOString().slice(0, 10));

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState(createEmptyForm());

  const query = trpc.delivery.listSchedules.useQuery({
    dateFrom: new Date(`${dateFrom}T00:00:00`).toISOString(),
    dateTo: new Date(`${dateTo}T23:59:59`).toISOString(),
    page: 1,
    limit: 100,
  });

  const readyJobsQuery = trpc.job.list.useQuery(
    { status: 'ready', limit: 100 },
    { enabled: createOpen },
  );

  const clientsQuery = trpc.clientes.list.useQuery(
    { status: 'active', limit: 200 },
    { enabled: createOpen },
  );

  const clientsById = useMemo(() => {
    const map = new Map<
      number,
      {
        id: number;
        street?: string | null;
        addressNumber?: string | null;
        neighborhood?: string | null;
        city?: string | null;
        state?: string | null;
      }
    >();
    for (const client of clientsQuery.data?.data ?? []) {
      map.set(client.id, client);
    }
    return map;
  }, [clientsQuery.data]);

  const createSchedule = trpc.delivery.createSchedule.useMutation({
    onSuccess: async () => {
      await utils.delivery.listSchedules.invalidate();
      setCreateOpen(false);
      setCreateError('');
      setForm(createEmptyForm());
    },
    onError: (mutationError) => {
      setCreateError(mutationError.message);
    },
  });

  const schedules = query.data?.data ?? [];
  const readyJobs = readyJobsQuery.data?.data ?? [];

  const rows: DeliveryRow[] = schedules
    .map((schedule) => ({
      id: schedule.id,
      date: schedule.date.toString(),
      driverName: schedule.driverName ?? null,
      vehicle: schedule.vehicle ?? null,
      itemCount: Number((schedule as Record<string, unknown>).itemCount ?? 0),
      status: toDeliveryStatus(String((schedule as Record<string, unknown>).status ?? 'scheduled')),
    }))
    .filter((row) => {
      const normalized = search.trim().toLowerCase();
      if (!normalized) return true;
      return (
        row.id.toString().includes(normalized) ||
        (row.driverName ?? '').toLowerCase().includes(normalized) ||
        (row.vehicle ?? '').toLowerCase().includes(normalized)
      );
    });

  const columns: Column<DeliveryRow>[] = [
    {
      id: 'date',
      header: 'Data',
      width: '120px',
      cell: (row) => <span className="t-small text-[var(--fg-muted)]">{new Date(row.date).toLocaleDateString('pt-BR')}</span>,
    },
    {
      id: 'driver',
      header: 'Motorista',
      width: 'flex',
      cell: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium">{row.driverName ?? 'Sem motorista'}</span>
          <span className="t-small text-[var(--fg-muted)]">{row.vehicle ?? 'Veiculo nao informado'}</span>
        </div>
      ),
    },
    {
      id: 'stops',
      header: 'Paradas',
      width: '96px',
      align: 'right',
      cell: (row) => <span className="tabular-nums">{row.itemCount}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      width: '120px',
      cell: (row) => {
        const chip = DELIVERY_STATUS_CHIP[row.status];
        return <StatusChip label={chip.label} variant={chip.variant} />;
      },
    },
  ];

  const selectedJobs = useMemo(
    () => readyJobs.filter((job) => form.selectedJobIds.includes(job.id)),
    [form.selectedJobIds, readyJobs],
  );

  function toggleJob(jobId: number) {
    setForm((prev) => {
      const selected = prev.selectedJobIds.includes(jobId);
      const selectedJob = readyJobs.find((job) => job.id === jobId);
      const nextSelectedJobIds = selected
        ? prev.selectedJobIds.filter((id) => id !== jobId)
        : [...prev.selectedJobIds, jobId];

      const nextAddress = { ...prev.deliveryAddressByJobId };
      if (selected) {
        delete nextAddress[jobId];
      } else if (selectedJob) {
        const client = clientsById.get(selectedJob.clientId);
        nextAddress[jobId] = buildClientAddress(client ?? {}) || '';
      }

      return {
        ...prev,
        selectedJobIds: nextSelectedJobIds,
        deliveryAddressByJobId: nextAddress,
      };
    });
  }

  function updateJobAddress(jobId: number, value: string) {
    setForm((prev) => ({
      ...prev,
      deliveryAddressByJobId: {
        ...prev.deliveryAddressByJobId,
        [jobId]: value,
      },
    }));
  }

  function addPickupStop() {
    const firstClientId = clientsQuery.data?.data?.[0]?.id;
    const firstClient = firstClientId ? clientsById.get(firstClientId) : undefined;
    setForm((prev) => ({
      ...prev,
      pickupStops: [
        ...prev.pickupStops,
        {
          tempId: `pickup-${Date.now()}-${Math.random()}`,
          clientId: firstClientId ? String(firstClientId) : '',
          deliveryAddress: firstClient ? buildClientAddress(firstClient) : '',
          notes: '',
        },
      ],
    }));
  }

  function updatePickupStop(tempId: string, patch: Partial<PickupStopForm>) {
    setForm((prev) => ({
      ...prev,
      pickupStops: prev.pickupStops.map((stop) => {
        if (stop.tempId !== tempId) return stop;
        const next = { ...stop, ...patch };
        if (patch.clientId !== undefined) {
          const nextClient = clientsById.get(Number(patch.clientId));
          next.deliveryAddress = buildClientAddress(nextClient ?? {}) || next.deliveryAddress;
        }
        return next;
      }),
    }));
  }

  function removePickupStop(tempId: string) {
    setForm((prev) => ({
      ...prev,
      pickupStops: prev.pickupStops.filter((stop) => stop.tempId !== tempId),
    }));
  }

  function openCreateModal() {
    setCreateError('');
    setForm(createEmptyForm());
    setCreateOpen(true);
  }

  function submitCreateSchedule() {
    if (!form.date) {
      setCreateError('Informe a data do roteiro');
      return;
    }

    if (selectedJobs.length === 0 && form.pickupStops.length === 0) {
      setCreateError('Adicione pelo menos uma parada de entrega ou coleta');
      return;
    }

    for (const job of selectedJobs) {
      const address = form.deliveryAddressByJobId[job.id]?.trim();
      if (!address) {
        setCreateError(`Informe o endereco da parada da OS ${job.code}`);
        return;
      }
    }

    for (const pickup of form.pickupStops) {
      if (!pickup.clientId) {
        setCreateError('Selecione o dentista em todas as paradas de coleta');
        return;
      }
      if (!pickup.deliveryAddress.trim()) {
        setCreateError('Informe o endereco em todas as paradas de coleta');
        return;
      }
    }

    const deliveryStops = selectedJobs.map((job, index) => ({
      stopType: 'delivery' as const,
      jobId: job.id,
      clientId: job.clientId,
      deliveryAddress: form.deliveryAddressByJobId[job.id]!.trim(),
      sortOrder: index,
    }));

    const pickupStops = form.pickupStops.map((pickup, index) => ({
      stopType: 'pickup' as const,
      clientId: Number(pickup.clientId),
      deliveryAddress: pickup.deliveryAddress.trim(),
      sortOrder: deliveryStops.length + index,
      notes: pickup.notes.trim() || undefined,
    }));

    createSchedule.mutate({
      date: new Date(`${form.date}T12:00:00`).toISOString(),
      driverName: form.driverName.trim() || undefined,
      vehicle: form.vehicle.trim() || undefined,
      notes: form.notes.trim() || undefined,
      items: [...deliveryStops, ...pickupStops],
    });
  }

  return (
    <div className="space-y-4">
      <PageTitle
        subtitle="Planejamento semanal de roteiros com status operacional por entrega."
        actions={(
          <Button type="button" onClick={openCreateModal}>
            <Plus className="size-4" aria-hidden="true" />
            Novo roteiro
          </Button>
        )}
      >
        Roteiros de entrega
      </PageTitle>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={(
          <>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              aria-label="Data inicial"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              aria-label="Data final"
            />
          </>
        )}
      />

      {query.error ? (
        <p className="t-small text-[var(--destructive)]">Erro ao carregar roteiros: {query.error.message}</p>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.id}
        onRowClick={(row) => navigate(`/entregas/${row.id}`)}
        loading={query.isLoading}
        loadingRows={8}
        empty={{
          title: 'Nenhum roteiro encontrado',
          description: 'Ajuste os filtros para continuar.',
          cta: (
            <Button type="button" size="sm" onClick={openCreateModal}>
              Novo roteiro
            </Button>
          ),
        }}
      />

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-lg)]">
            <h2 className="mb-4 flex items-center gap-2 font-[var(--font-display)] text-2xl text-[var(--fg-strong)]">
              <Calendar className="size-5" aria-hidden="true" />
              Novo roteiro
            </h2>

            {createError ? (
              <p className="mb-4 t-small text-[var(--destructive)]">{createError}</p>
            ) : null}

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="t-small text-[var(--fg-muted)]">Data do roteiro</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                    className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="t-small text-[var(--fg-muted)]">Motorista (opcional)</span>
                  <input
                    type="text"
                    value={form.driverName}
                    onChange={(event) => setForm((prev) => ({ ...prev, driverName: event.target.value }))}
                    placeholder="Nome do motorista"
                    className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                  />
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="t-small text-[var(--fg-muted)]">Veiculo (opcional)</span>
                <input
                  type="text"
                  value={form.vehicle}
                  onChange={(event) => setForm((prev) => ({ ...prev, vehicle: event.target.value }))}
                  placeholder="Placa ou modelo"
                  className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="t-small text-[var(--fg-muted)]">Observacoes (opcional)</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="t-small text-[var(--fg-muted)]">Paradas de entrega (OS prontas)</span>
                  <span className="t-small text-[var(--fg-muted)]">{selectedJobs.length} selecionada(s)</span>
                </div>

                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]">
                  {readyJobsQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2 p-5 t-small text-[var(--fg-muted)]">
                      <Loader2 className="size-4 animate-spin" /> Carregando OS prontas...
                    </div>
                  ) : readyJobs.length === 0 ? (
                    <div className="p-5 t-small text-[var(--fg-muted)]">
                      Nenhuma OS pronta disponivel para roteirizacao.
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--border)]">
                      {readyJobs.map((job) => {
                        const checked = form.selectedJobIds.includes(job.id);
                        return (
                          <div key={job.id} className={cn('px-4 py-3', checked && 'bg-[var(--bg-muted)]')}>
                            <button
                              type="button"
                              onClick={() => toggleJob(job.id)}
                              className="flex w-full items-start justify-between gap-4 text-left"
                            >
                              <div>
                                <p className="text-sm font-semibold text-[var(--fg-strong)]">{job.code}</p>
                                <p className="t-small text-[var(--fg-muted)]">
                                  {job.clientName ?? 'Cliente sem nome'}
                                  {job.patientName ? ` - ${job.patientName}` : ''}
                                </p>
                              </div>
                              <span className="t-small text-[var(--fg-muted)]">
                                {new Date(job.deadline).toLocaleDateString('pt-BR')}
                              </span>
                            </button>

                            {checked ? (
                              <div className="mt-3 flex items-center gap-2">
                                <MapPin className="size-4 text-[var(--fg-muted)]" aria-hidden="true" />
                                <input
                                  value={form.deliveryAddressByJobId[job.id] ?? ''}
                                  onChange={(event) => updateJobAddress(job.id, event.target.value)}
                                  placeholder="Endereco da entrega"
                                  className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="t-small text-[var(--fg-muted)]">Paradas de coleta</span>
                  <Button type="button" size="sm" variant="secondary" onClick={addPickupStop}>
                    + Adicionar coleta
                  </Button>
                </div>

                {form.pickupStops.length === 0 ? (
                  <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg)] p-4 t-small text-[var(--fg-muted)]">
                    Nenhuma parada de coleta adicionada.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {form.pickupStops.map((stop) => (
                      <div key={stop.tempId} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-3">
                        <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                          <select
                            value={stop.clientId}
                            onChange={(event) => updatePickupStop(stop.tempId, { clientId: event.target.value })}
                            className="h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm"
                          >
                            <option value="">Selecione o dentista</option>
                            {(clientsQuery.data?.data ?? []).map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                              </option>
                            ))}
                          </select>

                          <input
                            value={stop.deliveryAddress}
                            onChange={(event) => updatePickupStop(stop.tempId, { deliveryAddress: event.target.value })}
                            placeholder="Endereco da coleta"
                            className="h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-sm"
                          />

                          <button
                            type="button"
                            onClick={() => removePickupStop(stop.tempId)}
                            className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--destructive)]"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="button" loading={createSchedule.isPending} onClick={submitCreateSchedule}>
                  Criar roteiro
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
