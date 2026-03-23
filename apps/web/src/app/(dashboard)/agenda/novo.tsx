import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function EventCreatePage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'prova' | 'entrega' | 'retirada' | 'reuniao' | 'manutencao' | 'outro'>('outro');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [jobId, setJobId] = useState('');
  const [clientId, setClientId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly'>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(60);

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
      clientId: clientId ? Number(clientId) : undefined,
      employeeId: employeeId ? Number(employeeId) : undefined,
      recurrence,
      recurrenceEndDate: recurrenceEndDate ? new Date(recurrenceEndDate).toISOString() : undefined,
      reminderMinutesBefore,
    });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate('/agenda')} className="flex items-center gap-2 text-neutral-400 hover:text-white text-sm">
        <ArrowLeft size={14} />
        Voltar
      </button>

      <div>
        <h1 className="text-2xl font-bold text-white">Novo Evento</h1>
        <p className="text-neutral-400 text-sm mt-1">Crie eventos de prova, entrega, reuniao e manutencao.</p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Titulo</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field w-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="input-field w-full">
              <option value="outro">Outro</option>
              <option value="prova">Prova</option>
              <option value="entrega">Entrega</option>
              <option value="retirada">Retirada</option>
              <option value="reuniao">Reuniao</option>
              <option value="manutencao">Manutencao</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Lembrete (minutos antes)</label>
            <input value={reminderMinutesBefore} onChange={(e) => setReminderMinutesBefore(Number(e.target.value))} type="number" className="input-field w-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Inicio</label>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Fim</label>
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="input-field w-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">OS (opcional)</label>
            <input type="number" value={jobId} onChange={(e) => setJobId(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Cliente (opcional)</label>
            <input type="number" value={clientId} onChange={(e) => setClientId(e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Funcionario (opcional)</label>
            <input type="number" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="input-field w-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Recorrencia</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as typeof recurrence)} className="input-field w-full">
              <option value="none">Sem recorrencia</option>
              <option value="daily">Diaria</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quinzenal</option>
              <option value="monthly">Mensal</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Fim da recorrencia (opcional)</label>
            <input type="datetime-local" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} className="input-field w-full" />
          </div>
        </div>

        {createMutation.error && <p className="text-red-400 text-sm">{createMutation.error.message}</p>}

        <button
          onClick={handleCreate}
          disabled={createMutation.isPending || !title || !startAt || !endAt}
          className="w-full px-4 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl font-medium flex items-center justify-center gap-2"
        >
          {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
          Criar Evento
        </button>
      </div>
    </div>
  );
}

