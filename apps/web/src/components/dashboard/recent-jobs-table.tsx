import { Link } from 'react-router-dom';
import type { RecentJob } from '@proteticflow/shared';
import { formatBRL } from '../../lib/format';
import { FadeIn } from '../shared/page-transition';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'Em andamento', color: 'bg-blue-500/20 text-blue-400' },
  quality_check: { label: 'Qualidade', color: 'bg-yellow-500/20 text-yellow-500' },
  ready: { label: 'Pronto', color: 'bg-emerald-500/20 text-emerald-400' },
  delivered: { label: 'Entregue', color: 'bg-primary/20 text-primary' },
  cancelled: { label: 'Cancelado', color: 'bg-destructive/20 text-destructive' },
};

export function RecentJobsTable({ jobs }: { jobs: RecentJob[] }) {
  return (
    <FadeIn className="premium-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Trabalhos Recentes</h3>
      </div>
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground p-8 text-center">Nenhum trabalho cadastrado</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Código</th>
                <th className="px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Cliente</th>
                <th className="px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Prazo</th>
                <th className="px-5 py-3 text-xs text-muted-foreground font-semibold uppercase tracking-wider text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const statusInfo = STATUS_LABEL[job.status] ?? { label: job.status, color: 'bg-zinc-800 text-zinc-300' };
                const isOverdue =
                  job.dueDate &&
                  new Date(job.dueDate) < new Date() &&
                  !['delivered', 'cancelled'].includes(job.status);

                return (
                  <tr key={job.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        to={`/trabalhos/${job.id}`}
                        className="text-primary hover:text-primary-foreground/80 font-semibold transition-colors"
                      >
                        {job.code}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-foreground max-w-[180px] truncate">{job.clientName}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className={`px-5 py-3 text-xs ${isOverdue ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                      {formatDate(job.dueDate)}
                      {isOverdue && ' ⚠'}
                    </td>
                    <td className="px-5 py-3 text-right text-foreground font-semibold tabular-nums">
                      {formatBRL(job.totalCents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </FadeIn>
  );
}
