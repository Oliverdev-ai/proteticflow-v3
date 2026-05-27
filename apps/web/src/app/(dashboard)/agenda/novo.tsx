import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { FormError, FormField } from '../../../components/ui/form';
import { Input } from '../../../components/ui/input';

type EventType = 'prova' | 'entrega' | 'retirada' | 'reuniao' | 'manutencao' | 'outro';

type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';

const ACTIVE_JOB_STATUSES = new Set(['pending', 'in_progress', 'quality_check', 'ready', 'rework_in_progress']);

export default function EventCreatePage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('outro');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [jobId, setJobId] = useState('');
  const [dentistId, setDentistId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(60);

  const clientsQuery = trpc.clientes.list.useQuery({ status: 'active', limit: 100 });
  const jobsQuery = trpc.job.list.useQuery({ limit: 100 });

  const jobs = useMemo(
    () => (jobsQuery.data?.data ?? []).filter((job) => ACTIVE_JOB_STATUSES.has(job.status)),
    [jobsQuery.data],
  );

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === Number(jobId)),
    [jobId, jobs],
  );

  useEffect(() => {
    if (!selectedJob) return;
    if (selectedJob.clientId) {
      setDentistId(String(selectedJob.clientId));
    }
  }, [selectedJob]);

  const createMutation = trpc.agenda.create.useMutation({
    onSuccess: async () => {
      await utils.agenda.list.invalidate();
      navigate('/agenda');
    },
  });

  function toIsoLocal(datetimeLocal: string): string {
    return new Date(datetimeLocal).toISOString();
  }

  function handleCreate() {
    createMutation.mutate({
      title,
      type,
      startAt: toIsoLocal(startAt),
      endAt: toIsoLocal(endAt),
      allDay: false,
      jobId: jobId ? Number(jobId) : undefined,
      clientId: dentistId ? Number(dentistId) : undefined,
      employeeId: employeeId ? Number(employeeId) : undefined,
      recurrence,
      recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : undefined,
      reminderMinutesBefore,
    });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/agenda')}
        className="flex items-center gap-2 text-muted-foreground hover:text-white text-sm"
      >
        <ArrowLeft size={14} />
        Voltar
      </button>

      <div>
        <h1 className="text-2xl font-bold text-white">Novo Evento</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Crie eventos de prova, entrega, reuniao e manutencao.
        </p>
      </div>

      <div className="bg-muted border border-border rounded-lg p-5 space-y-4">
        <Input label="Título" required value={title} onChange={(e) => setTitle(e.target.value)} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Tipo">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className="input-field w-full"
            >
              <option value="outro">Outro</option>
              <option value="prova">Prova</option>
              <option value="entrega">Entrega</option>
              <option value="retirada">Retirada</option>
              <option value="reuniao">Reuniao</option>
              <option value="manutencao">Manutencao</option>
            </select>
          </FormField>
          <Input
            label="Lembrete (minutos antes)"
            value={reminderMinutesBefore}
            onChange={(e) => setReminderMinutesBefore(Number(e.target.value))}
            type="number"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Início"
            required
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
          <Input
            label="Fim"
            required
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="OS (opcional)">
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Selecione...</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.code} - {job.clientName ?? 'Cliente sem nome'}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Cliente / Dentista (opcional)">
            <select
              value={dentistId}
              onChange={(e) => setDentistId(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Selecione...</option>
              {(clientsQuery.data?.data ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </FormField>
          <Input
            label="Funcionário (opcional)"
            type="number"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Recorrência">
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
              className="input-field w-full"
            >
              <option value="none">Sem recorrencia</option>
              <option value="daily">Diaria</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quinzenal</option>
              <option value="monthly">Mensal</option>
            </select>
          </FormField>
          <Input
            label="Fim da recorrência (opcional)"
            type="datetime-local"
            value={recurrenceEndDate}
            onChange={(e) => setRecurrenceEndDate(e.target.value)}
          />
        </div>

        {createMutation.error ? <FormError>{createMutation.error.message}</FormError> : null}

        <button
          onClick={handleCreate}
          disabled={createMutation.isPending || !title || !startAt || !endAt}
          className="w-full px-4 py-3 bg-primary hover:bg-primary disabled:opacity-60 text-white rounded-xl font-medium flex items-center justify-center gap-2"
        >
          {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
          Criar Evento
        </button>
      </div>
    </div>
  );
}
