import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, useDraggable, useDroppable, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Monitor,
  PauseCircle,
  PlayCircle,
  User,
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { canTransition, JOB_STATUS_LABELS, KANBAN_COLUMNS, type JobStatus } from '@proteticflow/shared';
import { useNavigate } from 'react-router-dom';
import { PageTransition } from '../../components/shared/page-transition';
import { H1, Subtitle, Muted } from '../../components/shared/typography';
import { cn } from '../../lib/utils';
import { ProofBadge } from '../../components/jobs/proof-badge';
import { SuspendDialog } from '../../components/jobs/suspend-dialog';

type KanbanJob = {
  id: number;
  code: string;
  status: JobStatus;
  deadline: string | Date;
  createdAt: string | Date;
  patientName?: string | null;
  clientName?: string | null;
  totalCents: number;
  clientId: number;
  assignedTo?: number | null;
  firstItemName?: string;
  urgency?: 'overdue' | 'due24h' | 'onTime';
  jobSubType: 'standard' | 'proof' | 'rework';
  isUrgent: boolean;
  suspendedAt?: string | Date | null;
  suspendReason?: string | null;
  proofDueDate?: string | Date | null;
  proofReturnedAt?: string | Date | null;
  reworkParentId?: number | null;
};

type MoveStatus = 'pending' | 'in_progress' | 'quality_check' | 'ready' | 'delivered';

type SuspendedJob = {
  id: number;
  code: string;
  status: JobStatus;
  jobSubType: 'standard' | 'proof' | 'rework';
  isUrgent: boolean;
  patientName: string | null;
  clientName: string | null;
  deadline: string | Date;
  suspendedAt: string | Date | null;
  suspendReason: string | null;
};

const COLUMN_COLORS: Record<string, string> = {
  pending: 'border-muted',
  in_progress: 'border-blue-500/30',
  quality_check: 'border-amber-500/30',
  ready: 'border-primary/50',
  delivered: 'border-emerald-500/30',
};

const URGENCY_DOT: Record<string, string> = {
  overdue: 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]',
  due24h: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  onTime: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
};

function JobCard({
  job,
  dragging = false,
  onSuspend,
}: {
  job: KanbanJob;
  dragging?: boolean;
  onSuspend?: (job: KanbanJob) => void;
}) {
  const navigate = useNavigate();
  const deadline = new Date(job.deadline);
  const now = Date.now();
  const diff = deadline.getTime() - now;
  const urgency = diff < 0 ? 'overdue' : diff < 86400000 ? 'due24h' : 'onTime';

  return (
    <div
      data-testid={`kanban-card-${job.id}`}
      onClick={() => !dragging && navigate(`/trabalhos/${job.id}`)}
      className={cn(
        'flex cursor-pointer flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-all active:scale-[0.98]',
        dragging
          ? 'rotate-2 scale-105 border-primary opacity-50 shadow-2xl ring-2 ring-primary/20'
          : 'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-primary">
          {job.code}
        </span>
        <div
          className={cn('h-2 w-2 rounded-full', URGENCY_DOT[urgency] || 'bg-muted')}
          title={urgency === 'overdue' ? 'Atrasado' : urgency === 'due24h' ? 'Vence em 24h' : 'No Prazo'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {job.isUrgent ? (
          <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-destructive">
            URGENTE
          </span>
        ) : null}

        {job.jobSubType === 'proof' ? (
          <ProofBadge proofDueDate={job.proofDueDate} proofReturnedAt={job.proofReturnedAt} />
        ) : null}

        {job.jobSubType === 'rework' ? (
          <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-500">
            REMOLDAGEM
          </span>
        ) : null}
      </div>

      <div className="space-y-0.5">
        {job.clientName ? <p className="line-clamp-1 text-xs font-bold text-foreground">{job.clientName}</p> : null}
        {job.patientName ? (
          <p className="line-clamp-1 text-[11px] font-semibold italic text-muted-foreground">{job.patientName}</p>
        ) : null}

        {job.firstItemName ? (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 p-1.5">
            <div className="rounded-md bg-background p-1 text-muted-foreground">
              <Clock size={10} />
            </div>
            <p className="flex-1 truncate text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
              {job.firstItemName}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-1">
        <span
          className={cn(
            'flex items-center gap-1 text-[10px] font-bold',
            urgency === 'overdue'
              ? 'text-destructive'
              : urgency === 'due24h'
                ? 'text-amber-500'
                : 'text-muted-foreground',
          )}
        >
          {deadline.toLocaleDateString('pt-BR')}
        </span>

        <div className="flex items-center gap-2">
          {job.assignedTo ? (
            <div className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
              <User size={8} /> #{job.assignedTo}
            </div>
          ) : null}

          {onSuspend ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSuspend(job);
              }}
              className="rounded-md border border-border bg-muted px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground transition-all hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              Suspender
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({
  status,
  jobs,
  isDragOver,
  onSuspend,
}: {
  status: string;
  jobs: KanbanJob[];
  isDragOver: boolean;
  onSuspend: (job: KanbanJob) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[300px] flex-col gap-3 rounded-2xl p-2 transition-all duration-300',
        isDragOver ? 'bg-primary/5 ring-2 ring-primary/20 backdrop-blur-sm' : '',
      )}
    >
      {jobs.map((job) => (
        <DraggableCard key={job.id} job={job} onSuspend={onSuspend} />
      ))}
    </div>
  );
}

function DraggableCard({ job, onSuspend }: { job: KanbanJob; onSuspend: (job: KanbanJob) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id.toString(),
    data: { status: job.status },
  });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ touchAction: 'none' }}>
      <JobCard job={job} dragging={isDragging} onSuspend={onSuspend} />
    </div>
  );
}

export default function KanbanPage() {
  const navigate = useNavigate();
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [activeView, setActiveView] = useState<'active' | 'suspended'>('active');
  const [activeJob, setActiveJob] = useState<KanbanJob | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<KanbanJob | null>(null);
  const utils = trpc.useUtils();

  const boardQuery = trpc.job.getBoard.useQuery(
    {
      overdue: activeView === 'active' && overdueOnly ? true : undefined,
    },
    {
      enabled: activeView === 'active',
    },
  );

  const suspendedQuery = trpc.job.listSuspended.useQuery(undefined, {
    enabled: activeView === 'suspended',
  });

  const metricsQuery = trpc.job.getMetrics.useQuery();

  const moveCard = trpc.job.moveCard.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.job.getBoard.invalidate(),
        utils.job.getMetrics.invalidate(),
        utils.job.listSuspended.invalidate(),
      ]);
    },
    onError: (error) => setToastMsg(error.message),
  });

  const suspendMutation = trpc.job.suspend.useMutation({
    onSuccess: async () => {
      setSuspendTarget(null);
      await Promise.all([
        utils.job.getBoard.invalidate(),
        utils.job.getMetrics.invalidate(),
        utils.job.listSuspended.invalidate(),
      ]);
    },
    onError: (error) => setToastMsg(error.message),
  });

  const unsuspendMutation = trpc.job.unsuspend.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.job.getBoard.invalidate(),
        utils.job.getMetrics.invalidate(),
        utils.job.listSuspended.invalidate(),
      ]);
    },
    onError: (error) => setToastMsg(error.message),
  });

  const columnsMap = useMemo(() => {
    const map: Record<string, KanbanJob[]> = {};

    for (const status of KANBAN_COLUMNS) {
      const col = boardQuery.data?.columns.find((column) => column.status === status);
      const jobs = (col?.jobs ?? []) as KanbanJob[];

      map[status] = [...jobs].sort((a, b) => {
        const urgentDiff = Number(b.isUrgent) - Number(a.isUrgent);
        if (urgentDiff !== 0) return urgentDiff;

        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
    }

    return map;
  }, [boardQuery.data]);

  const suspendedJobs = (suspendedQuery.data ?? []) as SuspendedJob[];

  function handleDragStart(event: DragStartEvent) {
    const jobId = Number(event.active.id);
    if (!Number.isFinite(jobId)) return;

    const job = Object.values(columnsMap)
      .flat()
      .find((item) => item.id === jobId);

    setActiveJob(job ?? null);
  }

  function handleDragOver(event: { over: { id: string | number } | null }) {
    setDragOverCol(event.over?.id?.toString() ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragOverCol(null);
    setActiveJob(null);

    const { active, over } = event;
    if (!over || !active.data.current) return;

    const fromStatus = active.data.current.status as JobStatus;
    const toStatus = over.id as MoveStatus;
    if (fromStatus === 'cancelled') return;
    if (fromStatus === toStatus) return;

    if (!canTransition(fromStatus, toStatus)) {
      setToastMsg(
        `Transição de "${JOB_STATUS_LABELS[fromStatus]}" para "${JOB_STATUS_LABELS[toStatus]}" não é permitida`,
      );
      setTimeout(() => setToastMsg(''), 4000);
      return;
    }

    const jobId = Number(active.id);
    if (!Number.isFinite(jobId)) return;

    moveCard.mutate({ jobId, newStatus: toStatus });
  }

  const isLoading = activeView === 'active' ? boardQuery.isLoading : suspendedQuery.isLoading;
  const error = activeView === 'active' ? boardQuery.error : suspendedQuery.error;

  return (
    <PageTransition className="flex h-full flex-col gap-6 overflow-hidden p-4 md:p-1">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <H1>Fluxo de Produção</H1>
          <Subtitle>Acompanhe status, urgências, provas e OS suspensas em tempo real</Subtitle>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/kanban-tv')}
            className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-2.5 text-xs font-bold text-sky-500 shadow-sm transition-all hover:bg-sky-500/10 active:scale-95"
          >
            <Monitor size={14} /> Modo TV
          </button>

          <button
            type="button"
            onClick={() => setActiveView('active')}
            className={cn(
              'rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all',
              activeView === 'active'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
            )}
          >
            Ativas
          </button>

          <button
            type="button"
            onClick={() => setActiveView('suspended')}
            className={cn(
              'rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all',
              activeView === 'suspended'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
                : 'border-border bg-card text-muted-foreground hover:border-amber-500/40 hover:text-foreground',
            )}
          >
            Suspensas ({suspendedQuery.data?.length ?? 0})
          </button>

          {activeView === 'active' ? (
            <button
              type="button"
              onClick={() => setOverdueOnly((value) => !value)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold shadow-sm transition-all active:scale-95',
                overdueOnly
                  ? 'border-destructive bg-destructive text-destructive-foreground shadow-destructive/20'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              <AlertTriangle size={14} /> Somente atrasadas
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-xl border border-border bg-card px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Ativas: <span className="text-foreground">{metricsQuery.data?.activeCount ?? 0}</span>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Atrasadas: <span className="text-destructive">{metricsQuery.data?.overdueCount ?? 0}</span>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Urgentes: <span className="text-destructive">{metricsQuery.data?.urgentActiveCount ?? 0}</span>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Provas vencidas: <span className="text-amber-500">{metricsQuery.data?.proofOverdueCount ?? 0}</span>
        </div>
      </div>

      {activeView === 'active' ? (
        <div className="flex items-center gap-6 px-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">No prazo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              24h restantes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Atrasado</span>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-primary" size={32} />
          <Muted>Carregando quadro de produção...</Muted>
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <AlertCircle className="font-black text-destructive" size={32} />
          <p className="text-sm font-bold text-destructive">{error.message}</p>
        </div>
      ) : activeView === 'active' ? (
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver as never}
          onDragEnd={handleDragEnd}
        >
          <div className="custom-scrollbar flex flex-1 gap-4 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map((status) => {
              const colJobs = columnsMap[status] ?? [];

              return (
                <div
                  key={status}
                  className={cn(
                    'flex w-[280px] min-w-[280px] shrink-0 flex-col gap-4 rounded-3xl border bg-muted/20 p-4 transition-all',
                    COLUMN_COLORS[status] || 'border-border',
                  )}
                >
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/40 p-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground">
                      {JOB_STATUS_LABELS[status] ?? status}
                    </h3>
                    <div className="rounded-lg bg-primary/20 px-2 py-0.5 text-[10px] font-black text-primary">
                      {colJobs.length}
                    </div>
                  </div>

                  <DroppableColumn
                    status={status}
                    jobs={colJobs}
                    isDragOver={dragOverCol === status}
                    onSuspend={(job) => setSuspendTarget(job)}
                  />
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeJob ? (
              <div className="pointer-events-none scale-105 overflow-hidden rounded-2xl ring-4 ring-primary/20 drop-shadow-2xl">
                <JobCard job={activeJob} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="custom-scrollbar flex-1 space-y-3 overflow-auto rounded-3xl border border-border bg-card/40 p-4">
          {suspendedJobs.length === 0 ? (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 text-center">
              <PauseCircle size={36} className="text-muted-foreground/30" />
              <p className="text-sm font-black uppercase tracking-wider text-foreground">Nenhuma OS suspensa</p>
              <p className="max-w-md text-xs font-semibold text-muted-foreground">
                Quando uma OS for suspensa, ela aparece aqui e pode ser reativada com um clique.
              </p>
            </div>
          ) : (
            suspendedJobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider text-primary">
                      {job.code}
                    </span>
                    {job.isUrgent ? (
                      <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-destructive">
                        URGENTE
                      </span>
                    ) : null}
                    {job.jobSubType === 'proof' ? <ProofBadge /> : null}
                    {job.jobSubType === 'rework' ? (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-500">
                        REMOLDAGEM
                      </span>
                    ) : null}
                  </div>

                  <p className="text-sm font-black text-foreground">
                    {job.clientName ?? 'Cliente não informado'} - {job.patientName ?? 'Paciente não informado'}
                  </p>

                  <p className="text-xs font-semibold text-muted-foreground">
                    Suspensa em{' '}
                    {job.suspendedAt ? new Date(job.suspendedAt).toLocaleString('pt-BR') : 'data não informada'}
                    {job.suspendReason ? ` · ${job.suspendReason}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/trabalhos/${job.id}`)}
                    className="rounded-xl border border-border bg-muted px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-all hover:text-foreground"
                  >
                    Ver OS
                  </button>

                  <button
                    type="button"
                    disabled={unsuspendMutation.isPending}
                    onClick={() => unsuspendMutation.mutate({ jobId: job.id })}
                    className="flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 transition-all hover:brightness-110 disabled:opacity-40"
                  >
                    <PlayCircle size={13} /> Reativar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {toastMsg ? (
        <div className="fixed bottom-10 left-1/2 z-[100] flex -translate-x-1/2 animate-in items-center gap-3 rounded-2xl border border-destructive-foreground/20 bg-destructive px-8 py-4 text-xs font-bold uppercase tracking-widest text-destructive-foreground shadow-2xl slide-in-from-bottom-5 duration-500">
          <AlertCircle size={18} />
          {toastMsg}
        </div>
      ) : null}

      <SuspendDialog
        open={Boolean(suspendTarget)}
        isSubmitting={suspendMutation.isPending}
        title={suspendTarget ? `Suspender ${suspendTarget.code}` : 'Suspender OS'}
        onClose={() => setSuspendTarget(null)}
        onConfirm={async (reason) => {
          if (!suspendTarget) return;
          await suspendMutation.mutateAsync({ jobId: suspendTarget.id, reason });
        }}
      />
    </PageTransition>
  );
}


