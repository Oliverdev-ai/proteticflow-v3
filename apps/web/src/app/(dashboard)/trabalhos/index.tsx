import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Clock,
  Eye,
  Briefcase,
  Filter,
  Hash,
  Building2,
  Calendar,
  DollarSign,
  Activity,
  X,
} from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@proteticflow/shared';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted, Large } from '../../../components/shared/typography';
import { EmptyState } from '../../../components/shared/empty-state';
import { cn } from '../../../lib/utils';
import { formatBRL } from '../../../lib/format';

type JobStatus =
  | 'pending'
  | 'in_progress'
  | 'quality_check'
  | 'ready'
  | 'completed_with_rework'
  | 'delivered'
  | 'cancelled';

const COLOR_MAP: Record<string, string> = {
  slate: 'bg-muted text-muted-foreground border-border',
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  red: 'bg-destructive/10 text-destructive border-destructive/20',
};

function StatusBadge({ status }: { status: JobStatus }) {
  const color = JOB_STATUS_COLORS[status] ?? 'slate';
  return (
    <span
      className={cn(
        'inline-flex items-center text-[9px] px-3 py-1 rounded-full border font-black uppercase tracking-widest',
        COLOR_MAP[color],
      )}
    >
      {JOB_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function DeadlineCell({ deadline, status }: { deadline: string; status: JobStatus }) {
  const d = new Date(deadline);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const isOverdue =
    diff < 0 && !['delivered', 'cancelled', 'completed_with_rework'].includes(status);
  const isSoon = diff > 0 && diff < 24 * 60 * 60 * 1000;

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className={cn(
          'flex items-center gap-1.5 text-xs font-black tracking-tight transition-colors',
          isOverdue ? 'text-destructive' : isSoon ? 'text-amber-500' : 'text-foreground',
        )}
      >
        {isOverdue ? (
          <AlertCircle size={14} strokeWidth={3} />
        ) : (
          <Calendar size={14} className="opacity-40" />
        )}
        {d.toLocaleDateString('pt-BR')}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
        {isOverdue ? 'Atrasado' : isSoon ? 'Vence em breve' : 'Prazo final'}
      </span>
    </div>
  );
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Status: Todos' },
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
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-7xl mx-auto pb-12">
      {/* Header Area */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <H1 className="tracking-tight">Ordens de Serviço</H1>
          <Subtitle>Gestão e rastreamento de produção em tempo real</Subtitle>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/trabalhos/novo')}
            className="flex items-center gap-3 px-6 py-4 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95"
          >
            <Plus size={16} strokeWidth={3} /> Abrir Nova OS
          </button>
        </div>
      </div>

      {/* Modern Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-card/30 backdrop-blur-sm p-4 rounded-[32px] border border-border shadow-sm">
        <div className="relative flex-1 min-w-[320px] group">
          <Search
            size={18}
            className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors duration-300"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCursor(undefined);
            }}
            placeholder="Pesquisar por Código, Paciente ou Clínica..."
            className="w-full bg-muted border border-border rounded-2xl pl-14 pr-6 py-4 text-sm font-semibold text-foreground placeholder:text-muted-foreground/30 transition-all focus:ring-4 focus:ring-primary/5 focus:border-primary/50 outline-none shadow-inner"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-all"
            >
              <X size={14} strokeWidth={3} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 pointer-events-none"
              size={16}
              strokeWidth={3}
            />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as JobStatus | '');
                setCursor(undefined);
              }}
              className="bg-card border border-border rounded-2xl pl-10 pr-10 py-4 text-[10px] font-black uppercase tracking-widest text-foreground focus:ring-4 focus:ring-primary/5 focus:border-primary/50 outline-none shadow-sm cursor-pointer appearance-none min-w-[200px]"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setOverdue((v) => !v);
              setCursor(undefined);
            }}
            className={cn(
              'flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest active:scale-95 shadow-sm',
              overdue
                ? 'bg-destructive text-destructive-foreground border-destructive shadow-lg shadow-destructive/20'
                : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:bg-muted',
            )}
          >
            <Clock size={16} strokeWidth={3} />
            {overdue ? 'Filtro: Em Atraso' : 'Ver Atrasadas'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <ScaleIn>
        {isLoading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-6">
            <div className="relative">
              <Loader2 className="animate-spin text-primary/30" size={64} strokeWidth={1.5} />
              <Activity
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary anim-pulse"
                size={24}
              />
            </div>
            <Muted className="font-black uppercase tracking-[0.3em] animate-pulse">
              Sincronizando Ordens de Serviço...
            </Muted>
          </div>
        ) : error ? (
          <div className="premium-card p-16 flex flex-col items-center gap-6 border-destructive/20 bg-destructive/[0.02]">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              <AlertCircle size={32} strokeWidth={2.5} />
            </div>
            <div className="text-center space-y-2">
              <Large className="text-destructive font-black tracking-tight">
                Erro ao recuperar dados
              </Large>
              <Muted className="max-w-xs">{error.message}</Muted>
            </div>
          </div>
        ) : data?.data.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Nenhuma OS disponível"
            description="Não encontramos nenhuma ordem de serviço que corresponda aos seus filtros de pesquisa."
          >
            <button
              onClick={() => navigate('/trabalhos/novo')}
              className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
            >
              Gerar OS Manual
            </button>
          </EmptyState>
        ) : (
          <div className="premium-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                      # Identificador
                    </th>
                    <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5 hidden md:table-cell">
                      Mandatário (Cliente)
                    </th>
                    <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5 hidden sm:table-cell">
                      Paciente Final
                    </th>
                    <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                      Status do Workflow
                    </th>
                    <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5 hidden md:table-cell">
                      Valoração
                    </th>
                    <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-8 py-5">
                      DeadLine
                    </th>
                    <th className="px-8 py-5 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data?.data.map((job) => (
                    <tr
                      key={job.id}
                      className="group hover:bg-primary/[0.01] transition-all duration-300"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/10 shadow-inner group-hover:scale-110 transition-transform">
                            <Hash size={16} strokeWidth={3} />
                          </div>
                          <span className="text-sm font-black text-foreground tracking-tighter group-hover:text-primary transition-colors">
                            {job.code}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 hidden md:table-cell">
                        <div className="flex items-center gap-3">
                          <Building2 size={16} className="text-muted-foreground/30" />
                          <span className="text-xs font-black text-foreground tracking-tight uppercase">
                            {job.clientName}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 hidden sm:table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-black text-muted-foreground border border-border">
                            {job.patientName?.charAt(0) || 'P'}
                          </div>
                          <span className="text-sm font-bold text-muted-foreground tracking-tight">
                            {job.patientName ?? 'Não informado'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <StatusBadge status={job.status as JobStatus} />
                      </td>
                      <td className="px-8 py-6 text-right hidden md:table-cell">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-black text-foreground tabular-nums tracking-tighter">
                            {formatBRL(job.totalCents)}
                          </span>
                          <div className="flex items-center gap-1 opacity-40">
                            <DollarSign size={10} className="text-muted-foreground" />
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                              Líquido
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <DeadlineCell
                          deadline={job.deadline.toString()}
                          status={job.status as JobStatus}
                        />
                      </td>
                      <td className="px-8 py-6 text-right">
                        <Link
                          to={`/trabalhos/${job.id}`}
                          className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground opacity-30 group-hover:opacity-100 transition-all hover:bg-primary hover:text-white hover:border-primary/50 active:scale-90"
                        >
                          <Eye size={18} strokeWidth={2.5} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data?.nextCursor && (
              <div className="p-8 border-t border-border bg-muted/20 text-center">
                <button
                  onClick={() => setCursor(data.nextCursor)}
                  className="px-8 py-4 bg-muted border border-border rounded-2xl text-[10px] font-black text-muted-foreground hover:text-foreground hover:bg-muted/80 uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-3 mx-auto"
                >
                  Carregar fluxo adicional <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            )}
          </div>
        )}
      </ScaleIn>
    </PageTransition>
  );
}
