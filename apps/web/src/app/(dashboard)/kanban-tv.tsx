import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers3, RotateCcw, Clock, Monitor } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { JOB_STATUS_CHIP, KANBAN_COLUMNS, type JobStatus } from '@proteticflow/shared';
import { PageTransition } from '../../components/shared/page-transition';
import { cn } from '../../lib/utils';

const STATUS_THEMES: Record<
  JobStatus,
  { border: string; bg: string; text: string; iconBg: string }
> = {
  pending: {
    border: 'border-muted',
    bg: 'bg-muted/10',
    text: 'text-muted-foreground',
    iconBg: 'bg-muted/20',
  },
  in_progress: {
    border: 'border-[var(--info)]',
    bg: 'bg-[var(--info-soft)]',
    text: 'text-[var(--info)]',
    iconBg: 'bg-[var(--info-soft)]',
  },
  quality_check: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    text: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
  },
  ready: {
    border: 'border-primary/50',
    bg: 'bg-primary/5',
    text: 'text-primary',
    iconBg: 'bg-primary/20',
  },
  rework_in_progress: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    text: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
  },
  suspended: {
    border: 'border-muted',
    bg: 'bg-muted/10',
    text: 'text-muted-foreground',
    iconBg: 'bg-muted/20',
  },
  delivered: {
    border: 'border-success/30',
    bg: 'bg-success/5',
    text: 'text-[var(--success)]',
    iconBg: 'bg-success/20',
  },
  cancelled: {
    border: 'border-destructive/30',
    bg: 'bg-destructive/5',
    text: 'text-destructive',
    iconBg: 'bg-destructive/20',
  },
};

export default function KanbanTvPage() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  const settingsQuery = trpc.settings.getSettingsOverview.useQuery();
  const boardQuery = trpc.job.getBoard.useQuery(
    {},
    {
      refetchInterval: 30000,
    },
  );
  const tenantLogoUrl = settingsQuery.data?.identity.logoUrl ?? null;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/kanban');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  if (boardQuery.isLoading) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <Monitor
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary"
            size={32}
          />
        </div>
        <p className="text-xl font-semibold uppercase tracking-normal text-foreground animate-pulse">
          Iniciando Monitor de Produção
        </p>
      </div>
    );
  }

  if (boardQuery.error) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="p-6 bg-destructive/10 rounded-lg border border-destructive/20 text-destructive flex flex-col items-center gap-4">
          <Layers3 size={48} />
          <p className="text-2xl font-semibold uppercase tracking-normal">
            {boardQuery.error.message}
          </p>
        </div>
      </div>
    );
  }

  const columns = KANBAN_COLUMNS.filter(
    (status) => status !== 'delivered' && status !== 'cancelled',
  );
  const boardColumns = boardQuery.data?.columns ?? [];
  const jobStatusLabel = (status: JobStatus) => JOB_STATUS_CHIP[status]?.label ?? status;

  return (
    <PageTransition className="h-screen w-screen bg-[#050505] text-foreground overflow-hidden flex flex-col p-8 cursor-none">
      {/* Header Premium */}
      <header className="flex items-center justify-between pb-8 border-b border-border/50">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-primary/20 border border-primary/30 rounded-lg flex items-center justify-center shadow-md shadow-sm overflow-hidden">
            {tenantLogoUrl ? (
              <img src={tenantLogoUrl} alt="Logo do laboratório" className="h-full w-full object-contain p-2" />
            ) : (
              <Layers3 size={42} className="text-primary" />
            )}
          </div>
          <div>
            {tenantLogoUrl ? (
              <h1 className="text-5xl font-semibold tracking-tighter text-white">Monitor do Laborat�rio</h1>
            ) : (
              <h1 className="text-5xl font-semibold tracking-tighter text-white">
                Protetic<span className="text-primary">Flow</span>
              </h1>
            )}
            <p className="text-sm font-bold uppercase tracking-normal text-muted-foreground opacity-60">
              Monitor de Chão de Fábrica
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-normal text-primary/80">
              Powered by ProteticFlow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-12">
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-3 text-muted-foreground">
              <RotateCcw
                size={20}
                className={cn(
                  'transition-all',
                  boardQuery.isFetching ? 'animate-spin text-primary' : 'opacity-40',
                )}
              />
              <span className="text-xs font-semibold uppercase tracking-normal">Auto-Refresh 30s</span>
            </div>
          </div>
          <div className="flex items-center gap-4 px-8 py-4 bg-muted/20 border border-border/50 rounded-lg shadow-inner group">
            <Clock size={32} className="text-primary group-hover:scale-[1.02] transition-transform" />
            <div className="text-5xl font-semibold tracking-tighter text-white tabular-nums">
              {currentTime.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Grid de Produção */}
      <main className="flex-1 min-h-0 pt-8 flex gap-8">
        {columns.map((status) => {
          const colJobs = boardColumns.find((column) => column.status === status)?.jobs ?? [];
          const theme = STATUS_THEMES[status as JobStatus] || STATUS_THEMES.pending;

          return (
            <div
              key={status}
              className="flex-1 flex flex-col bg-muted/5 rounded-[var(--radius-lg)] border border-border/30 overflow-hidden backdrop-blur-sm shadow-md"
            >
              <div
                className={cn(
                  'p-6 border-b border-border/50 flex items-center justify-between',
                  theme.bg,
                )}
              >
                <h2 className={cn('text-2xl font-semibold uppercase tracking-normal', theme.text)}>
                  {jobStatusLabel(status)}
                </h2>
                <div
                  className={cn(
                    'text-2xl font-semibold px-4 py-1 rounded-lg border',
                    theme.border,
                    theme.text,
                    'bg-background/50 shadow-sm',
                  )}
                >
                  {colJobs.length}
                </div>
              </div>

              <div className="flex-1 overflow-hidden p-6 flex flex-col gap-6 custom-scrollbar">
                {colJobs.slice(0, 6).map((job, idx) => (
                  <div
                    key={job.id}
                    className={cn(
                      'p-6 rounded-lg border-2 shadow-xl flex flex-col gap-3 transition-all animate-in fade-in slide-in-from-right-8',
                      theme.border,
                      theme.bg,
                      idx === 0
                        ? 'scale-100 ring-4 ring-primary/20 brightness-110 shadow-primary/10'
                        : 'scale-[0.98] opacity-90',
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-3xl font-semibold tracking-tighter text-white">
                        #{job.code}
                      </span>
                      <div
                        className={cn(
                          'px-4 py-1 rounded-xl text-sm font-semibold uppercase tracking-normal',
                          theme.iconBg,
                          theme.text,
                        )}
                      >
                        {job.clientName
                          ? `${job.clientName.toUpperCase().split(' ')[0]}`
                          : 'S/ PARCEIRO'}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-2xl font-bold text-foreground line-clamp-1">
                        {job.patientName || 'PACIENTE GERAL'}
                      </p>
                      {job.firstItemName && (
                        <p className="text-lg text-muted-foreground font-semibold uppercase tracking-normal leading-none truncate opacity-60">
                          {job.firstItemName}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock size={16} />
                        <span className="text-base font-bold uppercase tracking-normal">
                          {new Date(job.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      {job.deadline && (
                        <div
                          className={cn(
                            'px-4 py-2 rounded-lg font-semibold text-lg shadow-sm border',
                            new Date(job.deadline) < new Date()
                              ? 'bg-destructive/20 text-destructive border-destructive/20'
                              : 'bg-primary/20 text-primary border-primary/20',
                          )}
                        >
                          ENTREGA:{' '}
                          {new Date(job.deadline).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {colJobs.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-20 gap-4">
                    <Monitor size={64} className="text-muted-foreground" />
                    <p className="text-sm font-semibold uppercase tracking-normal">
                      Nenhum item nesta fila
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      <footer className="pt-8 flex items-center justify-between text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-normal">Sistema Operacional</span>
        </div>
        <div className="text-xs font-semibold uppercase tracking-normal opacity-40">
          Pressione{' '}
          <span className="text-primary px-2 py-1 bg-primary/10 border border-primary/20 rounded-md mx-1">
            ESC
          </span>{' '}
          para fechar monitor
        </div>
      </footer>
    </PageTransition>
  );
}
