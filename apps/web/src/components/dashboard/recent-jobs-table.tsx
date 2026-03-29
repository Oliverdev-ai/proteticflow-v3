import { Link } from 'react-router-dom';
import type { RecentJob } from '@proteticflow/shared';

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-neutral-800 text-neutral-300' },
  in_progress: { label: 'Em andamento', color: 'bg-blue-900/40 text-blue-300' },
  quality_check: { label: 'Qualidade', color: 'bg-yellow-900/40 text-yellow-300' },
  ready: { label: 'Pronto', color: 'bg-emerald-900/40 text-emerald-300' },
  delivered: { label: 'Entregue', color: 'bg-violet-900/40 text-violet-300' },
  cancelled: { label: 'Cancelado', color: 'bg-rose-900/40 text-rose-300' },
};

export function RecentJobsTable({ jobs }: { jobs: RecentJob[] }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-800">
        <h3 className="text-sm font-medium text-neutral-300">Trabalhos Recentes</h3>
      </div>
      {jobs.length === 0 ? (
        <p className="text-xs text-neutral-500 p-5 text-center">Nenhum trabalho cadastrado</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left">
                <th className="px-5 py-3 text-xs text-neutral-500 font-medium uppercase tracking-wider">Código</th>
                <th className="px-5 py-3 text-xs text-neutral-500 font-medium uppercase tracking-wider">Cliente</th>
                <th className="px-5 py-3 text-xs text-neutral-500 font-medium uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-xs text-neutral-500 font-medium uppercase tracking-wider">Prazo</th>
                <th className="px-5 py-3 text-xs text-neutral-500 font-medium uppercase tracking-wider text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const statusInfo = STATUS_LABEL[job.status] ?? { label: job.status, color: 'bg-neutral-800 text-neutral-300' };
                const isOverdue =
                  job.dueDate &&
                  new Date(job.dueDate) < new Date() &&
                  !['delivered', 'cancelled'].includes(job.status);

                return (
                  <tr key={job.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/40 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        to={`/trabalhos/${job.id}`}
                        className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
                      >
                        {job.code}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-neutral-300 max-w-[180px] truncate">{job.clientName}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className={`px-5 py-3 text-xs ${isOverdue ? 'text-rose-400 font-medium' : 'text-neutral-400'}`}>
                      {formatDate(job.dueDate)}
                      {isOverdue && ' ⚠'}
                    </td>
                    <td className="px-5 py-3 text-right text-neutral-300 font-medium tabular-nums">
                      {formatBRL(job.totalCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
