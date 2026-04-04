import { useState } from 'react';
import { DndContext, DragOverlay, useDraggable, useDroppable, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Loader2, AlertCircle, Clock, User, Monitor, AlertTriangle } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { canTransition, JOB_STATUS_LABELS, KANBAN_COLUMNS } from '@proteticflow/shared';
import { useNavigate } from 'react-router-dom';
import { PageTransition } from '../../components/shared/page-transition';
import { H1, Subtitle, Muted } from '../../components/shared/typography';
import { cn } from '../../lib/utils';

type JobStatus = 'pending' | 'in_progress' | 'quality_check' | 'ready' | 'delivered' | 'cancelled';
type KanbanJob = {
  id: number; code: string; status: string; deadline: string | Date;
  patientName?: string | null; clientName?: string | null; totalCents: number;
  clientId: number; assignedTo?: number | null;
  firstItemName?: string; urgency?: string;
};

const COLUMN_COLORS: Record<string, string> = {
  pending:       'border-muted',
  in_progress:   'border-blue-500/30',
  quality_check: 'border-amber-500/30',
  ready:         'border-primary/50',
  delivered:     'border-emerald-500/30',
};

const URGENCY_DOT: Record<string, string> = {
  overdue: 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]',
  due24h:  'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  onTime:  'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
};

function JobCard({ job, dragging = false }: { job: KanbanJob; dragging?: boolean }) {
  const navigate = useNavigate();
  const deadline = new Date(job.deadline);
  const now = Date.now();
  const diff = deadline.getTime() - now;
  const urgency = diff < 0 ? 'overdue' : diff < 86400000 ? 'due24h' : 'onTime';

  return (
    <div
      onClick={() => !dragging && navigate(`/trabalhos/${job.id}`)}
      className={cn(
        "bg-card border border-border rounded-2xl p-4 gap-3 flex flex-col cursor-pointer transition-all active:scale-[0.98]",
        dragging ? 'opacity-50 rotate-2 shadow-2xl scale-105 border-primary ring-2 ring-primary/20' : 'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-lg uppercase tracking-wider">{job.code}</span>
        <div className={cn("w-2 h-2 rounded-full", URGENCY_DOT[urgency] || 'bg-muted')} title={urgency === 'overdue' ? 'Atrasado' : urgency === 'due24h' ? 'Vence em 24h' : 'No Prazo'} />
      </div>
      
      <div className="space-y-0.5">
        {job.clientName && <p className="text-xs text-foreground font-bold line-clamp-1">{job.clientName}</p>}
        {job.patientName && <p className="text-[11px] text-muted-foreground font-semibold line-clamp-1 italic">{job.patientName}</p>}
        {job.firstItemName && (
          <div className="flex items-center gap-1.5 mt-2 p-1.5 bg-muted/30 rounded-lg border border-border/50">
            <div className="p-1 bg-background rounded-md text-muted-foreground"><Clock size={10} /></div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight truncate flex-1">{job.firstItemName}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
        <span className={cn(
          "flex items-center gap-1 text-[10px] font-bold",
          urgency === 'overdue' ? 'text-destructive' : urgency === 'due24h' ? 'text-amber-500' : 'text-muted-foreground'
        )}>
          {deadline.toLocaleDateString('pt-BR')}
        </span>
        {job.assignedTo && (
          <div className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded-md text-[9px] font-bold text-muted-foreground uppercase">
            <User size={8} /> #{job.assignedTo}
          </div>
        )}
      </div>
    </div>
  );
}

function DroppableColumn({ status, jobs, isDragOver }: { status: string; jobs: KanbanJob[]; isDragOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn(
      "flex flex-col gap-3 min-h-[300px] p-2 rounded-2xl transition-all duration-300",
      isDragOver ? 'bg-primary/5 ring-2 ring-primary/20 backdrop-blur-sm' : ''
    )}>
      {jobs.map(job => <DraggableCard key={job.id} job={job} />)}
    </div>
  );
}

function DraggableCard({ job }: { job: KanbanJob }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id, data: { status: job.status } });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ touchAction: 'none' }}>
      <JobCard job={job} dragging={isDragging} />
    </div>
  );
}

export default function KanbanPage() {
  const navigate = useNavigate();
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [activeJob, setActiveJob] = useState<KanbanJob | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const utils = trpc.useUtils();

  const { data, isLoading, error } = trpc.job.getBoard.useQuery({
    overdue: overdueOnly || undefined,
  });

  const moveCard  = trpc.job.moveCard.useMutation({
    onSuccess: () => utils.job.getBoard.invalidate(),
    onError: (e) => setToastMsg(e.message),
  });

  // Build columns map from board data
  const columnsMap: Record<string, KanbanJob[]> = {};
  for (const status of KANBAN_COLUMNS) {
    const col = data?.columns.find(c => c.status === status);
    columnsMap[status] = (col?.jobs ?? []) as unknown as KanbanJob[];
  }

  function handleDragStart(e: DragStartEvent) {
    const jobId = e.active.id as number;
    const job = Object.values(columnsMap).flat().find(j => j.id === jobId);
    setActiveJob(job ?? null);
  }

  function handleDragOver(e: { over: { id: string } | null }) {
    setDragOverCol(e.over?.id ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragOverCol(null);
    setActiveJob(null);
    const { active, over } = e;
    if (!over || !active.data.current) return;
    const fromStatus = active.data.current.status as JobStatus;
    const toStatus = over.id as JobStatus;
    if (fromStatus === 'cancelled' || toStatus === 'cancelled') return;
    if (fromStatus === toStatus) return;

    // Validate transition — if invalid, show toast (revert happens automatically since we don't update optimistically)
    if (!canTransition(fromStatus, toStatus)) {
      setToastMsg(`Transição de "${JOB_STATUS_LABELS[fromStatus]}" para "${JOB_STATUS_LABELS[toStatus]}" não é permitida`);
      setTimeout(() => setToastMsg(''), 4000);
      return;
    }

    moveCard.mutate({ jobId: active.id as number, newStatus: toStatus });
  }

  return (
    <PageTransition className="flex flex-col gap-6 h-full overflow-hidden p-4 md:p-1">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <H1>Fluxo de Produção</H1>
          <Subtitle>Acompanhe o status das OS em tempo real</Subtitle>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/kanban-tv')} 
            className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border border-sky-500/30 text-sky-500 bg-sky-500/5 hover:bg-sky-500/10 transition-all shadow-sm active:scale-95"
          >
            <Monitor size={14} /> Modo TV
          </button>
          <button 
            onClick={() => setOverdueOnly(v => !v)} 
            className={cn(
              "flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border transition-all shadow-sm active:scale-95",
              overdueOnly 
                ? 'bg-destructive text-destructive-foreground border-destructive shadow-destructive/20' 
                : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            )}
          >
            <AlertTriangle size={14} /> Somente Atrasadas
          </button>
        </div>
      </div>

      {/* Urgency legend */}
      <div className="flex items-center gap-6 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No prazo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">24h Restantes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Atrasado</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-primary" size={32} />
          <Muted>Carregando quadro de produção...</Muted>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <AlertCircle className="text-destructive font-black" size={32} />
          <p className="text-destructive font-bold text-sm">{error.message}</p>
        </div>
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver as never}
          onDragEnd={handleDragEnd}
        >
          {/* Columns */}
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1 custom-scrollbar">
            {KANBAN_COLUMNS.map(status => {
              const colJobs = columnsMap[status] ?? [];
              return (
                <div 
                  key={status} 
                  className={cn(
                    "flex flex-col gap-4 min-w-[280px] w-[280px] shrink-0 bg-muted/20 rounded-3xl border p-4 transition-all",
                    COLUMN_COLORS[status] || 'border-border'
                  )}
                >
                  <div className="flex items-center justify-between gap-3 bg-muted/40 p-3 rounded-2xl border border-border/50">
                    <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em]">{JOB_STATUS_LABELS[status] ?? status}</h3>
                    <div className="bg-primary/20 text-primary px-2 py-0.5 rounded-lg text-[10px] font-black">
                      {colJobs.length}
                    </div>
                  </div>
                  <DroppableColumn status={status} jobs={colJobs} isDragOver={dragOverCol === status} />
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeJob && (
              <div className="scale-105 pointer-events-none drop-shadow-2xl ring-4 ring-primary/20 rounded-2xl overflow-hidden">
                <JobCard job={activeJob} dragging />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-destructive border border-destructive-foreground/20 text-destructive-foreground text-xs font-bold uppercase tracking-widest px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-bottom-5 duration-500 flex items-center gap-3">
          <AlertCircle size={18} />
          {toastMsg}
        </div>
      )}
    </PageTransition>
  );
}
