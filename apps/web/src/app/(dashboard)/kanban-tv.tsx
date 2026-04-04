import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers3, RotateCcw } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import type { Job } from '@proteticflow/shared';

// Helper local ou reaproveitado de utilitários
function getStatusColor(status: string) {
  switch (status) {
    case 'entrada': return 'bg-zinc-800 border-zinc-700';
    case 'preparo': return 'bg-blue-900/30 border-blue-800/50';
    case 'producao': return 'bg-amber-900/30 border-amber-800/50';
    case 'acabamento': return 'bg-fuchsia-900/30 border-fuchsia-800/50';
    case 'pronto': return 'bg-emerald-900/30 border-emerald-800/50';
    case 'entregue': return 'bg-zinc-900/30 border-zinc-800/50 opacity-50';
    default: return 'bg-zinc-800 border-zinc-700';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'entrada': return 'ENTRADA';
    case 'preparo': return 'PREPARO';
    case 'producao': return 'PRODUÇÃO';
    case 'acabamento': return 'ACABAMENTO';
    case 'pronto': return 'PRONTO';
    case 'entregue': return 'ENTREGUE';
    default: return status.toUpperCase();
  }
}

export default function KanbanTvPage() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());

  const jobsQuery = trpc.jobs.list.useQuery({ limit: 100 }, {
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

  if (jobsQuery.isLoading) {
    return <div className="h-screen w-screen bg-black text-white flex items-center justify-center text-2xl">Carregando painel...</div>;
  }

  const jobs = jobsQuery.data?.data || [];
  const activeJobs = jobs.filter(j => j.status !== 'entregue' && j.status !== 'cancelado');

  const columns = ['entrada', 'preparo', 'producao', 'acabamento', 'pronto'] as const;

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
            <RotateCcw size={20} className={jobsQuery.isFetching ? 'animate-spin' : ''} />
            <span>Atualiza a cada 30s</span>
          </div>
          <div className="text-4xl font-light tracking-tighter text-white tabular-nums">
            {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 pt-6 flex gap-6">
        {columns.map(col => {
          const colJobs = activeJobs.filter(j => j.status === col);
          return (
            <div key={col} className="flex-1 flex flex-col bg-neutral-900/50 rounded-2xl border border-neutral-800/80 overflow-hidden">
              <div className="p-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-wider">{getStatusLabel(col)}</h2>
                <span className="text-xl font-medium px-3 py-1 bg-neutral-800 rounded-lg text-neutral-300">{colJobs.length}</span>
              </div>
              <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4">
                {colJobs.slice(0, 5).map(job => (
                  <div key={job.id} className={`p-5 rounded-xl border-2 shadow-lg ${getStatusColor(job.status)} flex flex-col gap-2`}>
                    <div className="flex items-start justify-between text-2xl font-bold">
                      <span className="truncate pr-4 text-white">OS #{job.code}</span>
                      <span className="shrink-0 text-sky-400">Dr(a). {job.client?.name.split(' ')[0]}</span>
                    </div>
                    {job.items?.[0] && (
                      <p className="text-xl text-neutral-300 truncate">{job.items[0].serviceName}</p>
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
