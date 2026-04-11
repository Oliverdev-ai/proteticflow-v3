import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileText,
  Package,
  Clock,
  Camera,
  Download,
  XCircle,
  ChevronRight,
  Activity,
  Calendar,
  DollarSign,
  User,
  Building2,
  Hash,
  Zap,
  ShieldCheck,
  CheckCircle2,
  MoreHorizontal,
  HelpCircle,
  FileCheck,
  Truck,
  Ban,
  Info,
  X,
  Landmark,
  PauseCircle,
  PlayCircle,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import {
  canTransition,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  type JobStatus,
} from '@proteticflow/shared';
import { formatBRL } from '../../../lib/format';
import { PageTransition, ScaleIn } from '../../../components/shared/page-transition';
import { H1, Subtitle, Muted, Large } from '../../../components/shared/typography';
import { EmptyState } from '../../../components/shared/empty-state';
import { cn } from '../../../lib/utils';
import { openPdfFromBase64 } from '../../../lib/pdf-export';
import { ProofBadge } from '../../../components/jobs/proof-badge';
import { SuspendDialog } from '../../../components/jobs/suspend-dialog';
import { ReworkDialog } from '../../../components/jobs/rework-dialog';

const COLOR_CLASS: Record<string, string> = {
  slate: 'bg-muted text-muted-foreground border-border',
  blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  red: 'bg-destructive/10 text-destructive border-destructive/20',
};

const TABS = [
  { id: 'dados', label: 'Específicos', icon: FileText, desc: 'Ficha Técnica' },
  { id: 'itens', label: 'Valoração', icon: Package, desc: 'Serviços' },
  { id: 'timeline', label: 'Workflow', icon: Clock, desc: 'Histórico' },
  { id: 'fotos', label: 'Evidências', icon: Camera, desc: 'Produção' },
];

const STATUS_FLOW: JobStatus[] = ['pending', 'in_progress', 'quality_check', 'ready', 'delivered'];

const STATUS_ICONS: Record<JobStatus, LucideIcon> = {
  pending: Clock,
  in_progress: Activity,
  quality_check: ShieldCheck,
  ready: FileCheck,
  rework_in_progress: Wrench,
  suspended: PauseCircle,
  delivered: Truck,
  cancelled: Ban,
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const jobId = parseInt(id ?? '0', 10);
  const [tab, setTab] = useState('dados');
  const [showCancel, setShowCancel] = useState(false);
  const [showSuspend, setShowSuspend] = useState(false);
  const [showRework, setShowRework] = useState(false);
  const [proofDueDateInput, setProofDueDateInput] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const utils = trpc.useUtils();

  const { data: job, isLoading, error } = trpc.job.get.useQuery({ id: jobId });
  const pdfQuery = trpc.job.generatePdf.useQuery(
    { id: jobId },
    { enabled: false, retry: false },
  );

  const invalidateJobViews = async () => {
    await Promise.all([
      utils.job.get.invalidate({ id: jobId }),
      utils.job.getBoard.invalidate(),
      utils.job.list.invalidate(),
      utils.job.listSuspended.invalidate(),
      utils.job.getMetrics.invalidate(),
    ]);
  };

  const changeStatus = trpc.job.changeStatus.useMutation({
    onSuccess: () => void invalidateJobViews(),
  });
  const suspendMutation = trpc.job.suspend.useMutation({
    onSuccess: () => {
      setShowSuspend(false);
      void invalidateJobViews();
    },
  });
  const unsuspendMutation = trpc.job.unsuspend.useMutation({
    onSuccess: () => void invalidateJobViews(),
  });
  const toggleUrgentMutation = trpc.job.toggleUrgent.useMutation({
    onSuccess: () => void invalidateJobViews(),
  });
  const markProofMutation = trpc.job.markAsProof.useMutation({
    onSuccess: () => {
      setProofDueDateInput('');
      void invalidateJobViews();
    },
  });
  const returnProofMutation = trpc.job.returnProof.useMutation({
    onSuccess: () => void invalidateJobViews(),
  });
  const createReworkMutation = trpc.job.createRework.useMutation({
    onSuccess: () => {
      setShowRework(false);
      void invalidateJobViews();
    },
  });

  const handleAdvance = () => {
    if (!job) return;
    const currentIdx = STATUS_FLOW.indexOf(job.status as JobStatus);
    const next = STATUS_FLOW[currentIdx + 1];
    if (next && canTransition(job.status as JobStatus, next)) {
      changeStatus.mutate({ jobId, newStatus: next });
    }
  };

  const handleCancel = () => {
    changeStatus.mutate({ jobId, newStatus: 'cancelled', cancelReason, notes: cancelReason });
    setShowCancel(false);
  };

  const handleToggleUrgent = () => {
    if (!job) return;
    toggleUrgentMutation.mutate({ jobId, isUrgent: !job.isUrgent });
  };

  const handleMarkProof = () => {
    if (!job || !proofDueDateInput) return;
    markProofMutation.mutate({
      jobId,
      proofDueDate: new Date(`${proofDueDateInput}T12:00:00`).toISOString(),
    });
  };

  const handlePdf = async () => {
    const result = await pdfQuery.refetch();
    const pdfBase64 = result.data?.pdfBase64;
    if (!pdfBase64) return;
    openPdfFromBase64(pdfBase64);
  };

  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6">
        <div className="relative">
          <Loader2 className="animate-spin text-primary/30" size={64} strokeWidth={1.5} />
          <Activity
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary"
            size={24}
          />
        </div>
        <Muted className="font-black uppercase tracking-[0.3em] animate-pulse">
          Recuperando OS...
        </Muted>
      </div>
    );

  if (error || !job)
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-6">
        <div className="w-16 h-16 rounded-3xl bg-destructive/10 flex items-center justify-center text-destructive border border-destructive/20">
          <AlertCircle size={32} strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <Large className="text-destructive font-black tracking-tight">
            {error?.message ?? 'Serviço não catalogado'}
          </Large>
          <Muted className="mt-1">Não foi possível localizar este registro no sistema.</Muted>
        </div>
        <button
          onClick={() => navigate('/trabalhos')}
          className="flex items-center gap-3 text-[10px] font-black text-primary hover:text-primary/80 transition-all uppercase tracking-[0.2em] bg-primary/10 px-6 py-3 rounded-2xl"
        >
          <ArrowLeft size={16} strokeWidth={3} /> Retornar à Listagem
        </button>
      </div>
    );

  const statusColor = JOB_STATUS_COLORS[job.status as JobStatus] ?? 'slate';
  const workflowStatus =
    job.status === 'rework_in_progress' || job.status === 'suspended'
      ? ((job.resumeStatus as JobStatus | null | undefined) ?? 'pending')
      : (job.status as JobStatus);
  const currentIdx = STATUS_FLOW.indexOf(workflowStatus);
  const nextStatus = STATUS_FLOW[currentIdx + 1];
  const isFinal = ['delivered', 'cancelled'].includes(job.status);
  const isProof = job.jobSubType === 'proof';
  const isPaused = job.status === 'suspended' || job.status === 'rework_in_progress' || Boolean(job.suspendedAt);
  const StatusIcon = STATUS_ICONS[job.status] || HelpCircle;
  const canManageProof = !isFinal && !isPaused;

  return (
    <PageTransition className="flex flex-col gap-8 h-full overflow-auto p-4 md:p-1 max-w-6xl mx-auto pb-16">
      {/* Header Area */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <Link
            to="/trabalhos"
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-muted border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all active:scale-95 shadow-sm"
          >
            <ArrowLeft size={20} strokeWidth={3} />
          </Link>
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <H1 className="tracking-tighter text-3xl">{job.code}</H1>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-[9px] px-3 py-1 rounded-full border font-black uppercase tracking-widest leading-none',
                  COLOR_CLASS[statusColor],
                )}
              >
                <StatusIcon size={12} strokeWidth={3} />
                {JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}
              </span>
              {job.isUrgent ? (
                <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-destructive">
                  URGENTE
                </span>
              ) : null}
              {job.jobSubType === 'proof' ? (
                <ProofBadge proofDueDate={job.proofDueDate} proofReturnedAt={job.proofReturnedAt} />
              ) : null}
              {job.jobSubType === 'rework' || job.status === 'rework_in_progress' ? (
                <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-500">
                  REMOLDAGEM
                </span>
              ) : null}
              {job.status === 'suspended' ? (
                <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-500">
                  SUSPENSA
                </span>
              ) : null}
            </div>
            <Subtitle className="flex items-center gap-2">
              Emitida em {new Date(job.createdAt).toLocaleDateString('pt-BR')} por{' '}
              <span className="text-foreground font-black uppercase text-[10px] tracking-widest">
                Sistema V3
              </span>
            </Subtitle>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePdf}
            className="flex h-12 items-center gap-3 rounded-2xl border border-border bg-muted/50 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-all shadow-sm hover:bg-muted hover:text-foreground active:scale-95"
          >
            <Download size={18} strokeWidth={3} /> Download OS
          </button>

          <button
            type="button"
            onClick={handleToggleUrgent}
            disabled={toggleUrgentMutation.isPending}
            className={cn(
              'flex h-12 items-center gap-2 rounded-2xl border px-4 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95',
              job.isUrgent
                ? 'border-destructive/40 bg-destructive/10 text-destructive hover:brightness-110'
                : 'border-border bg-card text-muted-foreground hover:border-destructive/30 hover:text-destructive',
            )}
          >
            {toggleUrgentMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            {job.isUrgent ? 'Remover Urgência' : 'Marcar Urgente'}
          </button>

          {isProof ? (
            <button
              type="button"
              onClick={() => returnProofMutation.mutate({ jobId })}
              disabled={returnProofMutation.isPending || !canManageProof}
              className="flex h-12 items-center gap-2 rounded-2xl border border-sky-500/40 bg-sky-500/10 px-4 text-[10px] font-black uppercase tracking-widest text-sky-600 transition-all hover:brightness-110 disabled:opacity-40"
            >
              {returnProofMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <PlayCircle size={14} />
              )}
              Retorno da Prova
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-2 py-2">
              <input
                type="date"
                value={proofDueDateInput}
                disabled={!canManageProof}
                onChange={(event) => setProofDueDateInput(event.target.value)}
                className="rounded-xl border border-border bg-muted px-3 py-2 text-[10px] font-black uppercase tracking-wider text-foreground outline-none focus:border-primary/40"
              />
              <button
                type="button"
                disabled={!proofDueDateInput || markProofMutation.isPending || !canManageProof}
                onClick={handleMarkProof}
                className="flex h-8 items-center gap-1 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 text-[9px] font-black uppercase tracking-widest text-sky-600 transition-all hover:brightness-110 disabled:opacity-40"
              >
                {markProofMutation.isPending ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : null}
                Marcar Prova
              </button>
            </div>
          )}

          {isPaused ? (
            <button
              type="button"
              onClick={() => unsuspendMutation.mutate({ jobId })}
              disabled={unsuspendMutation.isPending}
              className="flex h-12 items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-[10px] font-black uppercase tracking-widest text-emerald-500 transition-all hover:brightness-110 disabled:opacity-40"
            >
              {unsuspendMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <PlayCircle size={14} />
              )}
              {job.status === 'rework_in_progress' ? 'Retomar Produção' : 'Reativar'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSuspend(true)}
              className="flex h-12 items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 text-[10px] font-black uppercase tracking-widest text-amber-500 transition-all hover:brightness-110"
            >
              <PauseCircle size={14} />
              Suspender
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowRework(true)}
            disabled={createReworkMutation.isPending || isFinal || isPaused}
            className="flex h-12 items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 text-[10px] font-black uppercase tracking-widest text-amber-500 transition-all hover:brightness-110 disabled:opacity-40"
          >
            {createReworkMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wrench size={14} />
            )}
            Criar Remoldagem
          </button>

          {!isFinal && (
            <>
              {!isFinal && nextStatus && (
                <button
                  disabled={changeStatus.isPending}
                  onClick={handleAdvance}
                  className="flex h-12 items-center gap-3 rounded-2xl bg-primary px-5 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {changeStatus.isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={18} strokeWidth={3} />
                  )}
                  Avançar p/ {JOB_STATUS_LABELS[nextStatus]}
                </button>
              )}
              <button
                onClick={() => setShowCancel(true)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive shadow-sm transition-all hover:bg-destructive hover:text-white active:scale-95"
              >
                <Ban size={20} strokeWidth={3} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Workflow Bento Progress */}
      {!isFinal && (
        <ScaleIn className="bg-card/30 backdrop-blur-sm p-6 rounded-[32px] border border-border">
          <div className="relative flex items-center justify-between gap-2 max-w-4xl mx-auto">
            {STATUS_FLOW.map((s, i) => {
              const Icon = STATUS_ICONS[s];
              const isCurrent = s === workflowStatus;
              const isPast = i < currentIdx;
              return (
                <div key={s} className="flex flex-col items-center gap-3 flex-1 relative z-10">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-[20px] flex items-center justify-center text-sm font-black transition-all duration-700 shadow-lg',
                      isPast
                        ? 'bg-emerald-500 text-white shadow-emerald-500/10'
                        : isCurrent
                          ? 'bg-primary text-primary-foreground shadow-primary/30 scale-110 ring-4 ring-primary/10'
                          : 'bg-muted/40 text-muted-foreground border border-border opacity-30 grayscale',
                    )}
                  >
                    {isPast ? (
                      <CheckCircle2 size={24} strokeWidth={3} />
                    ) : (
                      <Icon size={20} strokeWidth={3} />
                    )}
                  </div>
                  <div className="hidden lg:flex flex-col items-center">
                    <span
                      className={cn(
                        'text-[9px] font-black uppercase tracking-widest text-center transition-all duration-700',
                        isCurrent
                          ? 'text-primary'
                          : isPast
                            ? 'text-emerald-500'
                            : 'text-muted-foreground opacity-30',
                      )}
                    >
                      {JOB_STATUS_LABELS[s]}
                    </span>
                  </div>

                  {i < STATUS_FLOW.length - 1 && (
                    <div
                      className={cn(
                        'absolute left-[calc(50%+24px)] right-[calc(-50%+24px)] top-6 h-0.5 rounded-full transition-all duration-1000',
                        isPast ? 'bg-emerald-500/50' : 'bg-muted/50',
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </ScaleIn>
      )}

      {/* Tabs Layout */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-2 p-1.5 bg-card/50 backdrop-blur-sm border border-border rounded-[28px] shadow-sm w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex flex-col items-start gap-0.5 px-6 py-3 transition-all rounded-[22px] group relative overflow-hidden',
                tab === t.id
                  ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/10'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <div className="flex items-center gap-3">
                <t.icon
                  size={16}
                  strokeWidth={3}
                  className={cn(
                    tab === t.id
                      ? 'text-white'
                      : 'text-muted-foreground opacity-60 group-hover:text-primary transition-colors',
                  )}
                />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{t.label}</span>
              </div>
              <span
                className={cn(
                  'text-[8px] font-bold uppercase tracking-widest ml-7 transition-opacity',
                  tab === t.id ? 'opacity-60' : 'opacity-30',
                )}
              >
                {t.desc}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content Rendering */}
        <div className="min-h-[500px]">
          {/* Tab: EspecÃ­ficos (Dados) */}
          {tab === 'dados' && (
            <ScaleIn className="premium-card p-10 flex flex-col gap-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
                <FileText size={400} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 relative">
                {[
                  {
                    label: 'Mandatário (Cliente)',
                    value: job.clientName,
                    icon: Building2,
                    color: 'text-primary',
                  },
                  {
                    label: 'Paciente Final',
                    value: job.patientName,
                    icon: User,
                    color: 'text-foreground',
                  },
                  {
                    label: 'Status Operacional',
                    value: JOB_STATUS_LABELS[job.status as JobStatus],
                    icon: Activity,
                    color: 'text-foreground',
                  },
                  {
                    label: 'Tipo de Prótese',
                    value: job.prothesisType,
                    icon: Zap,
                    color: 'text-foreground',
                  },
                  {
                    label: 'Material Base',
                    value: job.material,
                    icon: Landmark,
                    color: 'text-foreground',
                  },
                  {
                    label: 'Escala de Cor',
                    value: job.color,
                    icon: Activity,
                    color: 'text-foreground',
                  },
                  {
                    label: 'DeadLine Fatal',
                    value: job.deadline
                      ? new Date(job.deadline).toLocaleDateString('pt-BR')
                      : '-',
                    icon: Calendar,
                    color: 'text-amber-500',
                  },
                  {
                    label: 'Valor Consolidado',
                    value: formatBRL(job.totalCents),
                    icon: DollarSign,
                    color: 'text-emerald-500',
                  },
                  {
                    label: 'Número da Remessa',
                    value: job.code,
                    icon: Hash,
                    color: 'text-primary',
                  },
                ].map(
                  ({ label, value, icon: Icon, color }) =>
                    value && (
                      <div key={label} className="group/item flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/30 group-hover/item:bg-primary transition-colors" />
                          <Muted className="text-[10px] font-black uppercase tracking-[0.2em] group-hover/item:text-primary transition-colors">
                            {label}
                          </Muted>
                        </div>
                        <div className="flex items-center gap-4 pl-1">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-xl bg-muted/50 border border-border flex items-center justify-center opacity-60',
                              color,
                            )}
                          >
                            <Icon size={18} strokeWidth={2.5} />
                          </div>
                          <span
                            className={cn('text-lg font-black tracking-tight leading-none', color)}
                          >
                            {value}
                          </span>
                        </div>
                      </div>
                    ),
                )}
              </div>

              <div className="flex flex-col gap-4 pt-10 border-t border-border/50 relative">
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-primary" />
                  <Muted className="text-[10px] font-black uppercase tracking-widest">
                    Instruções Laboratoriais e Memorandos
                  </Muted>
                </div>
                <div className="bg-muted/30 p-8 rounded-[32px] border border-border/50 relative group/memo overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/[0.03] rounded-full blur-2xl -mr-8 -mt-8" />
                  <p className="text-sm font-semibold text-foreground leading-relaxed whitespace-pre-wrap relative italic opacity-80 group-hover/memo:opacity-100 transition-opacity">
                    {job.instructions ||
                      'Nenhum memorando técnico anexado a esta ordem de serviço.'}
                  </p>
                </div>
              </div>

              {job.cancelReason && (
                <div className="p-8 bg-destructive/[0.03] border-2 border-destructive/20 rounded-[32px] flex flex-col gap-4 animate-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 text-destructive">
                    <Ban size={20} strokeWidth={3} />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                      Motivo da Interrupção (Cancelamento)
                    </span>
                  </div>
                  <p className="text-sm font-black text-destructive tracking-tight leading-tight pl-8">
                    {job.cancelReason}
                  </p>
                </div>
              )}
            </ScaleIn>
          )}

          {/* Tab: ValoraÃ§Ã£o (Itens) */}
          {tab === 'itens' && (
            <ScaleIn className="premium-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-10 py-6">
                        Especificação Técnica
                      </th>
                      <th className="text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-10 py-6">
                        Volume
                      </th>
                      <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-10 py-6">
                        Valor Unitário
                      </th>
                      <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-10 py-6">
                        Var. %
                      </th>
                      <th className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-10 py-6">
                        Cálculo Líquido
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {job.items.map((item) => (
                      <tr
                        key={item.id}
                        className="group hover:bg-primary/[0.01] transition-all duration-300"
                      >
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted border border-border shadow-inner text-muted-foreground">
                              <Package size={18} />
                            </div>
                            <span className="text-sm font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">
                              {item.serviceNameSnapshot}
                            </span>
                          </div>
                        </td>
                        <td className="px-10 py-8 text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted/50 border border-border text-xs font-black tabular-nums">
                            {item.quantity}
                          </div>
                        </td>
                        <td className="px-10 py-8 text-right font-black text-muted-foreground tabular-nums">
                          {formatBRL(item.unitPriceCents)}
                        </td>
                        <td className="px-10 py-8 text-right">
                          <span
                            className={cn(
                              'text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest border shadow-inner',
                              Number(item.adjustmentPercent) > 0
                                ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                                : Number(item.adjustmentPercent) < 0
                                  ? 'text-destructive bg-destructive/10 border-destructive/20'
                                  : 'text-muted-foreground bg-muted border-border',
                            )}
                          >
                            {Number(item.adjustmentPercent) > 0 ? '+' : ''}
                            {item.adjustmentPercent}%
                          </span>
                        </td>
                        <td className="px-10 py-8 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-lg font-black text-primary tabular-nums tracking-tighter group-hover:scale-105 transition-transform origin-right">
                              {formatBRL(item.totalCents)}
                            </span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-40">
                              Subtotal Compilado
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-primary/[0.03] border-t-2 border-primary/20">
                    <tr>
                      <td colSpan={4} className="px-10 py-10 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <Muted className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                            Valor Consolidado da Remessa
                          </Muted>
                          <span className="text-xs font-bold text-muted-foreground opacity-60 italic">
                            Sujeito a variações por itens adicionais
                          </span>
                        </div>
                      </td>
                      <td className="px-10 py-10 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-4xl font-black text-primary tracking-tighter tabular-nums leading-none mb-1">
                            {formatBRL(job.totalCents)}
                          </span>
                          <div className="flex items-center gap-2 px-3 py-1 bg-primary text-white rounded-full text-[9px] font-black uppercase tracking-widest leading-none">
                            <ShieldCheck size={10} strokeWidth={3} /> Auditado
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </ScaleIn>
          )}

          {/* Tab: Workflow (Timeline) */}
          {tab === 'timeline' && (
            <ScaleIn className="premium-card p-12">
              <div className="flex items-center gap-4 mb-14 border-b border-border/50 pb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/10 shadow-inner">
                  <Activity size={24} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <Large className="tracking-tight">Rastreabilidade Operacional</Large>
                  <Muted className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Fluxo de controle e auditoria de status
                  </Muted>
                </div>
              </div>

              <div className="space-y-12 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-primary/60 before:via-border before:to-transparent">
                {job.logs.map((log, idx) => {
                  return (
                    <div
                      key={log.id}
                      className="flex gap-10 relative animate-in slide-in-from-left-4 duration-500"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <div className="relative z-10">
                        <div
                          className={cn(
                            'w-12 h-12 rounded-2xl border-4 border-card flex items-center justify-center shadow-xl transition-all duration-500',
                            log.toStatus === job.status
                              ? 'bg-primary text-white scale-110'
                              : 'bg-muted-foreground/20 text-white opacity-40 hover:opacity-100',
                          )}
                        >
                          {log.toStatus === job.status ? (
                            <div className="w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                          ) : (
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 -mt-1 bg-muted/20 p-8 rounded-[32px] border border-border/50 hover:border-primary/30 transition-all duration-500 group relative overflow-hidden">
                        {log.toStatus === job.status && (
                          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/[0.03] rounded-full blur-2xl -mr-12 -mt-12" />
                        )}

                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 relative">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1.5 text-[9px] px-3 py-1 rounded-full border font-black uppercase tracking-widest',
                                  log.toStatus === 'cancelled'
                                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                                    : 'bg-primary/10 text-primary border-primary/20',
                                )}
                              >
                                {JOB_STATUS_LABELS[log.toStatus as JobStatus] || log.toStatus}
                              </span>
                              {log.fromStatus && (
                                <ChevronRight size={12} className="text-muted-foreground/30" />
                              )}
                              {log.fromStatus && (
                                <span className="text-[9px] font-bold text-muted-foreground opacity-30 uppercase tracking-widest">
                                  {JOB_STATUS_LABELS[log.fromStatus as JobStatus] || log.fromStatus}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-black text-foreground tracking-tight group-hover:text-primary transition-colors mt-2 uppercase">
                              {log.fromStatus ? `Transição de Estágio` : `Abertura de Protocolo`}
                            </p>
                          </div>
                          <div className="flex flex-col lg:items-end gap-0.5">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                              {new Date(log.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                            <Muted className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                              {new Date(log.createdAt).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Muted>
                          </div>
                        </div>

                        {log.notes && (
                          <div className="relative p-5 bg-card/60 border border-border/40 rounded-2xl italic text-[11px] text-muted-foreground leading-relaxed shadow-inner">
                            <span className="absolute -top-3 left-6 px-2 bg-card text-[8px] font-black text-primary uppercase tracking-widest border border-border/40 rounded-full">
                              Nota de Auditoria
                            </span>
                            "{log.notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScaleIn>
          )}

          {/* Tab: EvidÃªncias (Fotos) */}
          {tab === 'fotos' && (
            <ScaleIn className="premium-card p-12">
              <div className="flex items-center gap-4 mb-14 border-b border-border/50 pb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/10 shadow-inner">
                  <Camera size={24} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <Large className="tracking-tight">Repositório Visual Técnico</Large>
                  <Muted className="text-[10px] font-black uppercase tracking-[0.2em]">
                    Capturas de produção e acabamento final
                  </Muted>
                </div>
              </div>

              {job.photos.length === 0 ? (
                <EmptyState
                  icon={Camera}
                  title="Galeria Técnica Vazia"
                  description="Nenhuma imagem de acompanhamento técnico foi anexada a este fluxo de trabalho."
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {job.photos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="group aspect-[4/5] bg-muted/40 rounded-[32px] overflow-hidden border-2 border-border/60 relative cursor-pointer ring-offset-background transition-all hover:ring-8 hover:ring-primary/10 hover:border-primary/40 shadow-xl animate-in zoom-in-95 duration-500"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <img
                        src={photo.url}
                        alt={photo.description ?? 'Foto Técnica'}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">
                        <div className="flex flex-col gap-1 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">
                            Evidência Laboratorial
                          </span>
                          <span className="text-sm font-black text-white tracking-tight uppercase leading-none">
                            {photo.description || 'Imagem S/ Descrição'}
                          </span>
                          <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-2">
                            Auditado em {new Date(photo.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                      <div className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity active:scale-90">
                        <MoreHorizontal size={20} strokeWidth={3} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScaleIn>
          )}
        </div>
      </div>

      {/* Modern Cancel Validation Dialog */}
      {showCancel && (
        <div className="fixed inset-0 bg-background/90 backdrop-blur-xl flex items-center justify-center z-[200] p-4 animate-in fade-in duration-500">
          <ScaleIn className="w-full max-w-lg">
            <div className="premium-card p-12 flex flex-col gap-10 relative shadow-2xl border-destructive/20 overflow-hidden bg-white dark:bg-[#0a0a0b]">
              {/* Accent decoration */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-destructive/[0.03] rounded-full blur-[60px] -mr-20 -mt-20" />

              <div className="flex justify-between items-start relative px-1">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive shadow-inner border border-destructive/10">
                    <Ban size={28} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <H1 className="text-2xl tracking-tighter text-destructive">Interromper OS</H1>
                    <Muted className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive/60">
                      Protocolo de Cancelamento Crítico
                    </Muted>
                  </div>
                </div>
                <button
                  onClick={() => setShowCancel(false)}
                  className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground transition-all active:scale-90 border border-transparent hover:border-border"
                >
                  <X size={24} strokeWidth={3} />
                </button>
              </div>

              <div className="flex flex-col gap-8 relative">
                <div className="p-6 bg-destructive/[0.02] rounded-[24px] border border-destructive/10 flex items-start gap-4">
                  <Info size={20} className="text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs font-semibold text-destructive/70 leading-relaxed">
                    Ao confirmar o cancelamento da <strong>OS {job.code}</strong>, todas as
                    provisões financeiras (contas a receber) e ordens de produção vinculadas serão
                    suspensas permanentemente. Este processo requer justificativa formal para
                    fins de auditoria laboratorial.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1 mb-1">
                    Justificativa da Interrupção *
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={5}
                    placeholder="Descreva o motivo real da interrupção do fluxo..."
                    className="w-full bg-muted border border-border rounded-[24px] px-6 py-5 text-sm font-semibold text-foreground focus:outline-none focus:ring-4 focus:ring-destructive/5 focus:border-destructive/30 transition-all shadow-inner resize-none placeholder:text-muted-foreground/30"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-border/50 relative">
                <button
                  onClick={() => setShowCancel(false)}
                  className="flex-1 py-5 rounded-2xl bg-muted border border-border text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-all active:scale-95"
                >
                  Retroceder
                </button>
                <button
                  disabled={!cancelReason.trim() || changeStatus.isPending}
                  onClick={handleCancel}
                  className="flex-[1.8] py-5 rounded-2xl bg-destructive text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-destructive/20 hover:brightness-110 active:scale-[0.98] disabled:opacity-30 transition-all flex items-center justify-center gap-3"
                >
                  {changeStatus.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <XCircle size={18} strokeWidth={3} />
                  )}
                  Efetivar Cancelamento
                </button>
              </div>
            </div>
          </ScaleIn>
        </div>
      )}

      <SuspendDialog
        open={showSuspend}
        isSubmitting={suspendMutation.isPending}
        title={`Suspender ${job.code}`}
        onClose={() => setShowSuspend(false)}
        onConfirm={async (reason) => {
          await suspendMutation.mutateAsync({ jobId, reason });
        }}
      />

      <ReworkDialog
        open={showRework}
        jobs={[
          {
            id: job.id,
            code: job.code,
            patientName: job.patientName,
            clientName: job.clientName,
            ...(job.items[0]?.serviceNameSnapshot
              ? { firstItemName: job.items[0].serviceNameSnapshot }
              : {}),
          }
        ]}
        defaultJobId={job.id}
        isSubmitting={createReworkMutation.isPending}
        onClose={() => setShowRework(false)}
        onConfirm={async (input) => {
          await createReworkMutation.mutateAsync({
            jobId: input.jobId,
            reason: input.reason,
          });
        }}
      />
    </PageTransition>
  );
}
