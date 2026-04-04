import { useState } from 'react';
import { DndContext, DragOverlay, useDraggable, useDroppable, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Loader2, AlertCircle, Clock, User } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { canTransition, JOB_STATUS_LABELS, KANBAN_COLUMNS } from '@proteticflow/shared';
import { useNavigate } from 'react-router-dom';

type JobStatus = 'pending' | 'in_progress' | 'quality_check' | 'ready' | 'delivered' | 'cancelled';
type KanbanJob = {
  id: number; code: string; status: string; deadline: string | Date;
  patientName?: string | null; clientName?: string | null; totalCents: number;
  clientId: number; assignedTo?: number | null;
  firstItemName?: string; urgency?: string;
};

const COLUMN_COLORS: Record<string, string> = {
  pending:       'border-neutral-700',
  in_progress:   'border-blue-700/50',
  quality_check: 'border-amber-700/50',
  ready:         'border-green-700/50',
  delivered:     'border-emerald-700/50',
};

const URGENCY_DOT: Record<string, string> = {
  overdue: 'bg-red-500',
  due24h:  'bg-amber-500',
  onTime:  'bg-green-500',
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
      className={`bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-2 cursor-pointer hover:border-neutral-700 transition-colors ${dragging ? 'opacity-70 rotate-1 shadow-xl' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono font-bold text-violet-400">{job.code}</span>
        <div className={`w-2 h-2 rounded-full ${URGENCY_DOT[urgency] ?? 'bg-neutral-600'}`} title={urgency} />
      </div>
      {job.clientName && <p className="text-xs text-white font-medium line-clamp-1">{job.clientName}</p>}
      {job.patientName && <p className="text-xs text-neutral-300 line-clamp-1">{job.patientName}</p>}
      {job.firstItemName && <p className="text-xs text-neutral-400 line-clamp-1">{job.firstItemName}</p>}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className={`flex items-center gap-1 text-xs ${urgency === 'overdue' ? 'text-red-400' : urgency === 'due24h' ? 'text-amber-400' : 'text-neutral-500'}`}>
          <Clock size={10} />{deadline.toLocaleDateString('pt-BR')}
        </span>
        {job.assignedTo && <span className="text-xs text-neutral-600 flex items-center gap-1"><User size={10} />#{job.assignedTo}</span>}
      </div>
    </div>
  );
}

function DroppableColumn({ status, jobs, isDragOver }: { status: string; jobs: KanbanJob[]; isDragOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`flex flex-col gap-2 min-h-40 p-1 rounded-xl transition-colors ${isDragOver ? 'bg-violet-500/10' : ''}`}>
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
    <div className="flex flex-col gap-4 p-5 h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-white">Kanban</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/kanban-tv')} className="text-xs px-3 py-2 rounded-xl border border-sky-500/30 text-sky-400 hover:bg-sky-500/10 transition-colors">
            📺 Modo TV
          </button>
          <button onClick={() => setOverdueOnly(v => !v)} className={`text-xs px-3 py-2 rounded-xl border transition-colors ${overdueOnly ? 'bg-red-500/20 border-red-600 text-red-400' : 'border-neutral-700 text-neutral-400 hover:text-white'}`}>
            ⚠️ Atrasadas
          </button>
        </div>
      </div>

      {/* Urgency legend */}
      <div className="flex items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> No prazo</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Prazo em 24h</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Atrasado</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-violet-400" size={28} /></div>
      ) : error ? (
        <div className="flex flex-col items-center py-20 gap-3"><AlertCircle className="text-red-400" size={28} /><p className="text-red-400 text-sm">{error.message}</p></div>
      ) : (
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver as never}
          onDragEnd={handleDragEnd}
        >
          {/* Columns */}
          <div className="flex gap-3 overflow-x-auto pb-3 flex-1">
            {KANBAN_COLUMNS.map(status => {
              const colJobs = columnsMap[status] ?? [];
              return (
                <div key={status} className={`flex flex-col gap-2 min-w-56 w-56 shrink-0 bg-neutral-900/60 rounded-2xl border ${COLUMN_COLORS[status] ?? 'border-neutral-800'} p-3`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xs font-semibold text-neutral-300">{JOB_STATUS_LABELS[status] ?? status}</h3>
                    <span className="text-xs text-neutral-600 bg-neutral-800 px-1.5 py-0.5 rounded-full">{colJobs.length}</span>
                  </div>
                  <DroppableColumn status={status} jobs={colJobs} isDragOver={dragOverCol === status} />
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeJob && <JobCard job={activeJob} dragging />}
          </DragOverlay>
        </DndContext>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-50 max-w-sm text-center">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
