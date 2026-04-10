import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { Truck, Plus, Calendar, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';

function getWeekDays() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function createEmptyForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    driverName: '',
    vehicle: '',
    notes: '',
    selectedJobIds: [] as number[],
  };
}

export default function DeliveryListPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState(createEmptyForm());
  const utils = trpc.useUtils();
  const weekDays = getWeekDays();
  const startOfWeek = weekDays[0]!;
  const endOfWeek = weekDays[6]!;
  endOfWeek.setHours(23, 59, 59);

  const { data, isLoading, error } = trpc.delivery.listSchedules.useQuery({
    dateFrom: startOfWeek.toISOString(),
    dateTo: endOfWeek.toISOString(),
    page: 1,
    limit: 100,
  });

  const readyJobsQuery = trpc.job.list.useQuery(
    { status: 'ready', limit: 100 },
    { enabled: createOpen },
  );

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

  const schedules = data?.data ?? [];
  const readyJobs = readyJobsQuery.data?.data ?? [];

  const selectedJobs = useMemo(
    () => readyJobs.filter((job) => form.selectedJobIds.includes(job.id)),
    [form.selectedJobIds, readyJobs],
  );

  const byDay: Record<string, typeof schedules> = {};
  for (const s of schedules) {
    const key = new Date(s.date).toISOString().split('T')[0]!;
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(s);
  }

  const dayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];

  function toggleJob(jobId: number) {
    setForm((prev) => ({
      ...prev,
      selectedJobIds: prev.selectedJobIds.includes(jobId)
        ? prev.selectedJobIds.filter((id) => id !== jobId)
        : [...prev.selectedJobIds, jobId],
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
    if (selectedJobs.length === 0) {
      setCreateError('Selecione pelo menos 1 OS pronta para entrega');
      return;
    }

    createSchedule.mutate({
      date: new Date(`${form.date}T12:00:00`).toISOString(),
      driverName: form.driverName.trim() || undefined,
      vehicle: form.vehicle.trim() || undefined,
      notes: form.notes.trim() || undefined,
      items: selectedJobs.map((job, index) => ({
        jobId: job.id,
        clientId: job.clientId,
        sortOrder: index,
      })),
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="text-primary" size={24} />
            Roteiros de Entrega
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Calendario semanal dos roteiros</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Novo Roteiro
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-800 bg-red-900/20 p-4 text-sm text-red-300">
          Erro ao carregar roteiros: {error.message}
        </div>
      )}
      {isLoading && (
        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
          Carregando roteiros da semana...
        </div>
      )}
      {!isLoading && schedules.length === 0 && (
        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
          Nenhum roteiro cadastrado nesta semana.
        </div>
      )}

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-800">
          {weekDays.map((day, i) => {
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <div
                key={i}
                className={`p-3 text-center border-r border-zinc-800 last:border-r-0 ${isToday ? 'bg-primary/20' : ''}`}
              >
                <p className="text-xs text-zinc-500">{dayLabels[i]}</p>
                <p className={`text-lg font-semibold ${isToday ? 'text-primary' : 'text-white'}`}>
                  {day.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-7 min-h-48">
          {weekDays.map((day, i) => {
            const key = day.toISOString().split('T')[0]!;
            const daySchedules = byDay[key] ?? [];
            return (
              <div key={i} className="p-2 border-r border-zinc-800 last:border-r-0 space-y-2">
                {daySchedules.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-zinc-700">Sem roteiros</p>
                  </div>
                )}
                {daySchedules.map((s) => {
                  const itemCount = ((s as Record<string, unknown>).itemCount as number) ?? 0;
                  return (
                    <Link
                      key={s.id}
                      to={`/entregas/${s.id}`}
                      className="block p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white font-medium truncate">
                          {s.driverName ?? 'Sem motorista'}
                        </span>
                        <ChevronRight
                          size={12}
                          className="text-zinc-500 group-hover:text-zinc-300"
                        />
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {itemCount} {itemCount === 1 ? 'OS' : 'OSs'}
                      </p>
                      {s.vehicle && <p className="text-xs text-zinc-600">{s.vehicle}</p>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-primary" /> Novo Roteiro de Entrega
            </h2>

            {createError ? (
              <div className="mb-4 rounded-xl border border-red-800 bg-red-900/20 p-4 text-sm text-red-300">
                {createError}
              </div>
            ) : null}

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Data do roteiro</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Motorista (opcional)</label>
                  <input
                    type="text"
                    value={form.driverName}
                    onChange={(event) => setForm((prev) => ({ ...prev, driverName: event.target.value }))}
                    placeholder="Nome do motorista"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Veiculo (opcional)</label>
                <input
                  type="text"
                  value={form.vehicle}
                  onChange={(event) => setForm((prev) => ({ ...prev, vehicle: event.target.value }))}
                  placeholder="Placa ou modelo"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Observacoes (opcional)</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                  placeholder="Informacoes para o motorista"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder-zinc-600"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm text-zinc-400">OS prontas para entrega</label>
                  <span className="text-xs text-zinc-500">{selectedJobs.length} selecionada(s)</span>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60">
                  {readyJobsQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2 p-6 text-sm text-zinc-400">
                      <Loader2 size={16} className="animate-spin" /> Carregando OS prontas...
                    </div>
                  ) : readyJobs.length === 0 ? (
                    <div className="p-6 text-sm text-zinc-500">
                      Nenhuma OS em status concluido disponivel para roteirizacao.
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800">
                      {readyJobs.map((job) => {
                        const checked = form.selectedJobIds.includes(job.id);
                        return (
                          <button
                            key={job.id}
                            type="button"
                            onClick={() => toggleJob(job.id)}
                            className={`flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-zinc-900'}`}
                          >
                            <div>
                              <p className="text-sm font-semibold text-white">{job.code}</p>
                              <p className="text-xs text-zinc-400">
                                {job.clientName ?? 'Cliente sem nome'}
                                {job.patientName ? ` - ${job.patientName}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-zinc-500">
                                {new Date(job.deadline).toLocaleDateString('pt-BR')}
                              </span>
                              <CheckCircle2
                                size={16}
                                className={checked ? 'text-primary' : 'text-zinc-700'}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitCreateSchedule}
                  disabled={createSchedule.isPending}
                  className="flex-1 px-4 py-2 bg-primary hover:bg-primary text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {createSchedule.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                  Criar Roteiro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
