import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Loader2, AlertCircle, Clock, CheckCircle2, Eye } from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@proteticflow/shared';

type JobStatus = 'pending' | 'in_progress' | 'quality_check' | 'ready' | 'delivered' | 'cancelled';

const COLOR_MAP: Record<string, string> = {
  slate:   'bg-neutral-700/40 text-neutral-300',
  blue:    'bg-blue-500/20 text-blue-400',
  amber:   'bg-amber-500/20 text-amber-400',
  green:   'bg-green-500/20 text-green-400',
  emerald: 'bg-emerald-500/20 text-emerald-400',
  red:     'bg-red-500/20 text-red-400',
};

function StatusBadge({ status }: { status: JobStatus }) {
  const color = JOB_STATUS_COLORS[status] ?? 'slate';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COLOR_MAP[color] ?? ''}`}>
      {JOB_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function DeadlineCell({ deadline, status }: { deadline: string; status: JobStatus }) {
  const d = new Date(deadline);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const isOverdue = diff < 0 && !['delivered', 'cancelled'].includes(status);
  const isSoon = diff > 0 && diff < 24 * 60 * 60 * 1000;
  return (
    <span className={isOverdue ? 'text-red-400 font-medium' : isSoon ? 'text-amber-400 font-medium' : 'text-neutral-400'}>
      {isOverdue && '⚠️ '}{d.toLocaleDateString('pt-BR')}
    </span>
  );
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos os status' },
  ...Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

export default function JobListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [overdue, setOverdue] = useState(false);
  const [cursor, setCursor] = useState<number | undefined>();

  const { data, isLoading, error } = trpc.job.list.useQuery({
    search: search || undefined,
    status: status || undefined,
    overdue: overdue || undefined,
    cursor,
    limit: 20,
  });

  return (
    <div className="flex flex-col gap-5 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-white">Trabalhos (OS)</h1>
        <button onClick={() => navigate('/trabalhos/novo')} className="flex items-center gap-1.5 text-sm bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={15} /> Nova OS
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setCursor(undefined); }} placeholder="Buscar OS ou paciente..." className="input-field w-full pl-9" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value as JobStatus | ''); setCursor(undefined); }} className="input-field">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={() => { setOverdue(v => !v); setCursor(undefined); }} className={`flex items-center gap-1.5 text-sm px-3 py-2.5 rounded-xl border transition-colors ${overdue ? 'bg-red-500/20 border-red-600 text-red-400' : 'border-neutral-700 text-neutral-400 hover:text-white'}`}>
          <Clock size={14} /> Atrasadas
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-400" size={28} /></div>
      ) : error ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <AlertCircle className="text-red-400" size={28} />
          <p className="text-red-400 text-sm">{error.message}</p>
        </div>
      ) : data?.data.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center">
            <CheckCircle2 className="text-neutral-600" size={28} />
          </div>
          <p className="text-neutral-400">Nenhuma OS encontrada</p>
          <button onClick={() => navigate('/trabalhos/novo')} className="text-sm text-violet-400 hover:text-violet-300 transition-colors">+ Criar primeira OS</button>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left text-xs font-semibold text-neutral-500 px-5 py-3">Código</th>
                <th className="text-left text-xs font-semibold text-neutral-500 px-5 py-3 hidden md:table-cell">Cliente</th>
                <th className="text-left text-xs font-semibold text-neutral-500 px-5 py-3 hidden sm:table-cell">Paciente</th>
                <th className="text-left text-xs font-semibold text-neutral-500 px-5 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-neutral-500 px-5 py-3 hidden md:table-cell">Total</th>
                <th className="text-right text-xs font-semibold text-neutral-500 px-5 py-3">Prazo</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.data.map((job, idx) => (
                <tr key={job.id} className={`border-b border-neutral-800/50 hover:bg-neutral-800/40 transition-colors ${idx === (data.data.length - 1) ? 'border-0' : ''}`}>
                  <td className="px-5 py-3.5"><span className="font-mono text-sm text-violet-400 font-semibold">{job.code}</span></td>
                  <td className="px-5 py-3.5 hidden md:table-cell"><span className="text-sm text-white">{job.clientName}</span></td>
                  <td className="px-5 py-3.5 hidden sm:table-cell"><span className="text-sm text-neutral-400">{job.patientName ?? '—'}</span></td>
                  <td className="px-5 py-3.5"><StatusBadge status={job.status as JobStatus} /></td>
                  <td className="px-5 py-3.5 text-right hidden md:table-cell"><span className="text-sm text-white">{(job.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></td>
                  <td className="px-5 py-3.5 text-right text-sm"><DeadlineCell deadline={job.deadline.toString()} status={job.status as JobStatus} /></td>
                  <td className="px-5 py-3.5">
                    <Link to={`/trabalhos/${job.id}`} className="text-neutral-500 hover:text-violet-400 transition-colors"><Eye size={15} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.nextCursor && (
            <div className="p-4 border-t border-neutral-800 text-center">
              <button onClick={() => setCursor(data.nextCursor)} className="text-sm text-violet-400 hover:text-violet-300 transition-colors">Carregar mais →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
