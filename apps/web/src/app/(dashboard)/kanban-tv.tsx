import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers3, RotateCcw } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { JOB_STATUS_LABELS, KANBAN_COLUMNS, type JobStatus } from '@proteticflow/shared';

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: 'bg-zinc-800 border-zinc-700',
  in_progress: 'bg-blue-900/30 border-blue-800/50',
  quality_check: 'bg-amber-900/30 border-amber-800/50',
  ready: 'bg-emerald-900/30 border-emerald-800/50',
  delivered: 'bg-zinc-900/30 border-zinc-800/50 opacity-50',
  cancelled: 'bg-red-900/30 border-red-800/50 opacity-50',
};

export default function KanbanTvPage() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  const boardQuery = trpc.job.getBoard.useQuery({}, {
    refetchInterval: 30000, 
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/trabalhos/kanban');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  if (boardQuery.isLoading) {
    return <div className="h-screen w-screen bg-black text-white flex items-center justify-center text-2xl">Carregando painel...</div>;
  }

  if (boardQuery.error) {
    return <div className="h-screen w-screen bg-black text-red-400 flex items-center justify-center text-xl">{boardQuery.error.message}</div>;
  }

  const columns = KANBAN_COLUMNS.filter((status) => status !== 'delivered');
  const boardColumns = boardQuery.data?.columns ?? [];

  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden flex flex-col p-6 cursor-none">
      <header className="flex items-center justify-between pb-6 border-b border-neutral-900">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-sky-500 rounded-xl flex items-center justify-center">
            <Layers3 size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">ProteticFlow <span className="font-light text-sky-400 opacity-60">| CHÃO DE FÁBRICA</span></h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-neutral-500 text-lg">
            <RotateCcw size={20} className={boardQuery.isFetching ? 'animate-spin' : ''} />
            <span>Atualiza a cada 30s</span>
          </div>
          <div className="text-4xl font-light tracking-tighter text-white tabular-nums">
            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 pt-6 flex gap-6">
        {columns.map((status) => {
          const colJobs = boardColumns.find((column) => column.status === status)?.jobs ?? [];
          return (
            <div key={status} className="flex-1 flex flex-col bg-neutral-900/50 rounded-2xl border border-neutral-800/80 overflow-hidden">
              <div className="p-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-wider">{JOB_STATUS_LABELS[status]}</h2>
                <span className="text-xl font-medium px-3 py-1 bg-neutral-800 rounded-lg text-neutral-300">{colJobs.length}</span>
              </div>
              <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4">
                {colJobs.slice(0, 5).map(job => (
                  <div key={job.id} className={`p-5 rounded-xl border-2 shadow-lg ${STATUS_COLORS[job.status]} flex flex-col gap-2`}>
                    <div className="flex items-start justify-between text-2xl font-bold">
                      <span className="truncate pr-4 text-white">OS #{job.code}</span>
                      <span className="shrink-0 text-sky-400">{job.clientName ? `Dr(a). ${job.clientName.split(' ')[0]}` : 'Sem cliente'}</span>
                    </div>
                    {job.firstItemName && (
                      <p className="text-xl text-neutral-300 truncate">{job.firstItemName}</p>
                    )}
                    <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center text-lg">
                      <span className="text-neutral-400">
                        {new Date(job.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                      {job.deadline && (
                        <span className="font-medium text-amber-400">Entrega: {new Date(job.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>
      <div className="fixed bottom-4 right-6 text-neutral-600 font-medium opacity-30 cursor-default">Pressione ESC para sair</div>
    </div>
  );
}
