import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { AlertCircle, AlertTriangle, GripVertical, Loader2, PauseCircle, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { canTransition, JOB_STATUS_LABELS, type JobStatus } from '@proteticflow/shared';
import { trpc } from '../../lib/trpc';
import { cn } from '../../lib/utils';
import { PageTransition } from '../../components/shared/page-transition';
import { H1, Muted, Subtitle } from '../../components/shared/typography';
import { SuspendDialog } from '../../components/jobs/suspend-dialog';

type KanbanStatus = 'pending' | 'in_progress' | 'quality_check' | 'ready' | 'delivered';
type Density = 'compact' | 'comfortable';

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
};

type SuspendedJob = Pick<
  KanbanJob,
  'id' | 'code' | 'status' | 'jobSubType' | 'isUrgent' | 'patientName' | 'clientName' | 'deadline' | 'suspendedAt' | 'suspendReason'
>;

const KANBAN_STATUSES: KanbanStatus[] = ['pending', 'in_progress', 'quality_check', 'ready', 'delivered'];

function getUrgency(deadline: string | Date, status: JobStatus) {
  if (status === 'delivered') return 'onTime';
  const diffMs = new Date(deadline).getTime() - Date.now();
  if (diffMs < 0) return 'overdue';
  if (diffMs < 24 * 60 * 60 * 1000) return 'due24h';
  return 'onTime';
}

function UrgencyDot({ urgency }: { urgency: 'overdue' | 'due24h' | 'onTime' }) {
  return (
    <span
      className={cn(
        'h-2 w-2 rounded-full',
        urgency === 'overdue' && 'bg-destructive',
        urgency === 'due24h' && 'bg-warning',
        urgency === 'onTime' && 'bg-success',
      )}
    />
  );
}

function KanbanCard({
  job,
  density,
  dragging = false,
  onSuspend,
}: {
  job: KanbanJob;
  density: Density;
  dragging?: boolean;
  onSuspend?: (job: KanbanJob) => void;
}) {
  const navigate = useNavigate();
  const urgency = getUrgency(job.deadline, job.status);

  return (
    <article
      className={cn(
        'group flex cursor-pointer flex-col rounded-2xl border border-border bg-card shadow-sm transition-all hover:border-primary/50',
        density === 'compact' ? 'min-h-[72px] gap-2 p-3' : 'min-h-[112px] gap-3 p-4',
        job.isUrgent && 'border-l-[3px] border-l-primary',
        dragging && 'cursor-grabbing opacity-50 ring-2 ring-primary/30',
      )}
      onClick={() => !dragging && navigate(`/trabalhos/${job.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-semibold text-primary">{job.code}</p>
          <p className="truncate text-sm font-semibold text-foreground">
            {job.clientName ?? 'Cliente nao informado'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UrgencyDot urgency={urgency} />
          <GripVertical size={14} className="text-muted-foreground opacity-60" />
        </div>
      </div>

      {density === 'comfortable' ? (
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs text-muted-foreground">
            {job.firstItemName || job.patientName || 'Trabalho sem descricao'}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className={urgency === 'overdue' ? 'text-destructive' : ''}>
              {new Date(job.deadline).toLocaleDateString('pt-BR')}
            </span>
            {job.isUrgent ? <span className="text-primary">Urgente</span> : null}
          </div>
        </div>
      ) : null}

      {onSuspend && job.status !== 'delivered' ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSuspend(job);
          }}
          className="w-fit rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
        >
          Suspender
        </button>
      ) : null}
    </article>
  );
}

function DraggableCard({
  job,
  density,
  onSuspend,
}: {
  job: KanbanJob;
  density: Density;
  onSuspend: (job: KanbanJob) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: String(job.id),
    data: { status: job.status },
  });

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ touchAction: 'none' }}>
      <KanbanCard job={job} density={density} dragging={isDragging} onSuspend={onSuspend} />
    </div>
  );
}

function KanbanColumn({
  status,
  jobs,
  density,
  active,
  onSuspend,
}: {
  status: KanbanStatus;
  jobs: KanbanJob[];
  density: Density;
  active: boolean;
  onSuspend: (job: KanbanJob) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <section className="flex w-[284px] min-w-[284px] flex-col rounded-2xl border border-border bg-muted/20">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {JOB_STATUS_LABELS[status]}
        </h2>
        <span className="rounded-md bg-card px-2 py-1 font-tabular text-xs font-semibold text-foreground">
          {jobs.length}
        </span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[360px] flex-1 flex-col gap-3 p-3 transition-all',
          active && 'bg-primary/10 ring-2 ring-primary/30',
        )}
      >
        {jobs.length === 0 ? (
          <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
            Solte aqui
          </div>
        ) : (
          jobs.map((job) => (
            <DraggableCard key={job.id} job={job} density={density} onSuspend={onSuspend} />
          ))
        )}
      </div>
    </section>
  );
}

function buildColumns(data: unknown, overdueOnly: boolean): Record<KanbanStatus, KanbanJob[]> {
  const columns: Record<KanbanStatus, KanbanJob[]> = {
    pending: [],
    in_progress: [],
    quality_check: [],
    ready: [],
    delivered: [],
  };
  const source = data as { columns?: Array<{ status: string; jobs: KanbanJob[] }> } | undefined;

  for (const status of KANBAN_STATUSES) {
    const jobs = source?.columns?.find((column) => column.status === status)?.jobs ?? [];
    columns[status] = jobs
      .filter((job) => !overdueOnly || getUrgency(job.deadline, job.status) === 'overdue')
      .sort((a, b) => {
        const urgentDiff = Number(b.isUrgent) - Number(a.isUrgent);
        if (urgentDiff !== 0) return urgentDiff;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }

  return columns;
}

export default function KanbanPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const [activeView, setActiveView] = useState<'active' | 'suspended'>('active');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [density, setDensity] = useState<Density>('comfortable');
  const [activeJob, setActiveJob] = useState<KanbanJob | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [columns, setColumns] = useState<Record<KanbanStatus, KanbanJob[]> | null>(null);
  const [toast, setToast] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<KanbanJob | null>(null);

  const boardQuery = trpc.job.getBoard.useQuery({ overdue: overdueOnly || undefined }, { enabled: activeView === 'active' });
  const metricsQuery = trpc.job.getMetrics.useQuery();
  const suspendedQuery = trpc.job.listSuspended.useQuery(undefined, { enabled: activeView === 'suspended' });
  const uiPreferencesQuery = trpc.notification.getUiPreferences.useQuery();
  const updateUiPreferences = trpc.notification.updateUiPreferences.useMutation();
  const moveCard = trpc.job.updateStatus.useMutation();
  const suspendMutation = trpc.job.suspend.useMutation({
    onSuccess: async () => {
      setSuspendTarget(null);
      await Promise.all([utils.job.getBoard.invalidate(), utils.job.getMetrics.invalidate(), utils.job.listSuspended.invalidate()]);
    },
    onError: (error) => setToast(error.message),
  });
  const unsuspendMutation = trpc.job.unsuspend.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.job.getBoard.invalidate(), utils.job.getMetrics.invalidate(), utils.job.listSuspended.invalidate()]);
    },
    onError: (error) => setToast(error.message),
  });

  const serverColumns = useMemo(() => buildColumns(boardQuery.data, overdueOnly), [boardQuery.data, overdueOnly]);

  useEffect(() => {
    setColumns(serverColumns);
  }, [serverColumns]);

  useEffect(() => {
    if (uiPreferencesQuery.data?.kanbanDensity) {
      setDensity(uiPreferencesQuery.data.kanbanDensity);
    }
  }, [uiPreferencesQuery.data?.kanbanDensity]);

  function changeDensity(next: Density) {
    setDensity(next);
    updateUiPreferences.mutate({ kanbanDensity: next });
  }

  function handleDragStart(event: DragStartEvent) {
    const id = Number(event.active.id);
    const job = Object.values(columns ?? {})
      .flat()
      .find((item) => item.id === id);
    setActiveJob(job ?? null);
  }

  function handleDragOver(event: DragOverEvent) {
    setOverColumn(event.over?.id?.toString() ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setOverColumn(null);
    setActiveJob(null);

    const fromStatus = event.active.data.current?.status as JobStatus | undefined;
    const toStatus = event.over?.id as KanbanStatus | undefined;
    const jobId = Number(event.active.id);
    if (!fromStatus || !toStatus || !Number.isFinite(jobId) || fromStatus === toStatus) return;
    if (!canTransition(fromStatus, toStatus)) {
      setToast(`Transicao para ${JOB_STATUS_LABELS[toStatus]} nao permitida`);
      setTimeout(() => setToast(''), 4000);
      return;
    }

    const previous = columns ?? serverColumns;
    const moving = previous[fromStatus as KanbanStatus]?.find((job) => job.id === jobId);
    if (!moving) return;

    setColumns({
      ...previous,
      [fromStatus]: (previous[fromStatus as KanbanStatus] ?? []).filter((job) => job.id !== jobId),
      [toStatus]: [{ ...moving, status: toStatus }, ...(previous[toStatus] ?? [])],
    });

    try {
      await moveCard.mutateAsync({ jobId, newStatus: toStatus });
      await Promise.all([utils.job.getBoard.invalidate(), utils.job.getMetrics.invalidate()]);
    } catch (error) {
      setColumns(previous);
      setToast(error instanceof Error ? error.message : 'Falha ao mover trabalho');
      setTimeout(() => setToast(''), 4000);
    }
  }

  const currentColumns = columns ?? serverColumns;
  const suspendedJobs = (suspendedQuery.data ?? []) as SuspendedJob[];

  return (
    <PageTransition className="flex h-full flex-col gap-6 overflow-hidden p-4 md:p-1">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <H1>Kanban de Produção</H1>
          <Subtitle>Arraste trabalhos entre etapas com rollback automático em caso de falha.</Subtitle>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-card p-1">
            {(['comfortable', 'compact'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={cn(
                  'rounded-sm px-3 py-1.5 text-xs font-medium text-muted-foreground',
                  density === option && 'bg-muted text-foreground',
                )}
                onClick={() => changeDensity(option)}
              >
                {option === 'comfortable' ? 'Confortavel' : 'Compacto'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setActiveView('active')}
            className={cn('rounded-xl border px-4 py-2.5 text-xs font-semibold', activeView === 'active' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground')}
          >
            Ativas
          </button>
          <button
            type="button"
            onClick={() => setActiveView('suspended')}
            className={cn('rounded-xl border px-4 py-2.5 text-xs font-semibold', activeView === 'suspended' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground')}
          >
            Pausadas ({suspendedJobs.length})
          </button>
          {activeView === 'active' ? (
            <button
              type="button"
              onClick={() => setOverdueOnly((value) => !value)}
              className={cn('inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold', overdueOnly ? 'border-destructive bg-destructive-soft text-destructive' : 'border-border bg-card text-muted-foreground')}
            >
              <AlertTriangle size={15} /> Atrasadas
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          Ativas <strong className="font-tabular text-foreground">{metricsQuery.data?.activeCount ?? 0}</strong>
        </span>
        <span className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          Atrasadas <strong className="font-tabular text-destructive">{metricsQuery.data?.overdueCount ?? 0}</strong>
        </span>
        <span className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          Urgentes <strong className="font-tabular text-primary">{metricsQuery.data?.urgentActiveCount ?? 0}</strong>
        </span>
      </div>

      {activeView === 'active' ? (
        boardQuery.isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="animate-spin text-primary" size={28} />
            <Muted>Carregando quadro...</Muted>
          </div>
        ) : boardQuery.error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-destructive">
            <AlertCircle size={28} />
            <p className="text-sm font-semibold">{boardQuery.error.message}</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
              {KANBAN_STATUSES.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  jobs={currentColumns[status] ?? []}
                  density={density}
                  active={overColumn === status}
                  onSuspend={setSuspendTarget}
                />
              ))}
            </div>
            <DragOverlay>
              {activeJob ? <KanbanCard job={activeJob} density={density} dragging /> : null}
            </DragOverlay>
          </DndContext>
        )
      ) : (
        <div className="flex-1 overflow-auto rounded-2xl border border-border bg-card p-4">
          {suspendedQuery.isLoading ? (
            <div className="flex min-h-[260px] items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          ) : suspendedJobs.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-center">
              <PauseCircle className="text-muted-foreground" size={34} />
              <p className="font-semibold text-foreground">Nenhum trabalho pausado</p>
              <p className="max-w-sm text-sm text-muted-foreground">Trabalhos suspensos ou em remoldagem aparecem aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {suspendedJobs.map((job) => (
                <div key={job.id} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{job.code} - {job.clientName ?? 'Cliente nao informado'}</p>
                    <p className="text-sm text-muted-foreground">{job.suspendReason ?? JOB_STATUS_LABELS[job.status]}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => navigate(`/trabalhos/${job.id}`)} className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-card">
                      Abrir
                    </button>
                    <button type="button" disabled={unsuspendMutation.isPending} onClick={() => unsuspendMutation.mutate({ jobId: job.id })} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50">
                      <PlayCircle size={14} /> Reativar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {toast ? (
        <div className="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-destructive shadow-xl">
          <AlertCircle size={16} /> {toast}
        </div>
      ) : null}

      <SuspendDialog
        open={Boolean(suspendTarget)}
        isSubmitting={suspendMutation.isPending}
        title={suspendTarget ? `Suspender ${suspendTarget.code}` : 'Suspender trabalho'}
        onClose={() => setSuspendTarget(null)}
        onConfirm={async (reason) => {
          if (!suspendTarget) return;
          await suspendMutation.mutateAsync({ jobId: suspendTarget.id, reason });
        }}
      />
    </PageTransition>
  );
}
