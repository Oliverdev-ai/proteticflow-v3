import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, FileText, Package, Clock, Camera, Download, CheckCircle, XCircle } from 'lucide-react';
import { trpc } from '../../../lib/trpc';
import { canTransition, JOB_STATUS_LABELS, JOB_STATUS_COLORS } from '@proteticflow/shared';

type JobStatus = 'pending' | 'in_progress' | 'quality_check' | 'ready' | 'delivered' | 'cancelled';

const COLOR_CLASS: Record<string, string> = {
  slate: 'bg-neutral-700/40 text-neutral-300', blue: 'bg-blue-500/20 text-blue-400',
  amber: 'bg-amber-500/20 text-amber-400', green: 'bg-green-500/20 text-green-400',
  emerald: 'bg-emerald-500/20 text-emerald-400', red: 'bg-red-500/20 text-red-400',
};

const TABS = [
  { id: 'dados', label: 'Dados', icon: FileText },
  { id: 'itens', label: 'Itens', icon: Package },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'fotos', label: 'Fotos', icon: Camera },
];

const STATUS_FLOW: JobStatus[] = ['pending', 'in_progress', 'quality_check', 'ready', 'delivered'];

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const jobId = parseInt(id ?? '0', 10);
  const [tab, setTab] = useState('dados');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const utils = trpc.useUtils();

  const { data: job, isLoading, error } = trpc.job.get.useQuery({ id: jobId });
  const changeStatus = trpc.job.changeStatus.useMutation({
    onSuccess: () => utils.job.get.invalidate({ id: jobId }),
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

  const handlePdf = async () => {
    // Open PDF download endpoint in a new tab
    window.open(`/api/jobs/${jobId}/pdf`, '_blank');
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-violet-400" size={28} /></div>;
  if (error || !job) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertCircle className="text-red-400" size={28} />
      <p className="text-red-400 text-sm">{error?.message ?? 'OS não encontrada'}</p>
      <button onClick={() => navigate('/trabalhos')} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">← Voltar</button>
    </div>
  );

  const statusColor = JOB_STATUS_COLORS[job.status as JobStatus] ?? 'slate';
  const currentIdx = STATUS_FLOW.indexOf(job.status as JobStatus);
  const nextStatus = STATUS_FLOW[currentIdx + 1];
  const isFinal = ['delivered', 'cancelled'].includes(job.status);

  return (
    <div className="flex flex-col gap-5 p-6 h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/trabalhos')} className="text-neutral-500 hover:text-white transition-colors"><ArrowLeft size={18} /></button>
          <h1 className="text-xl font-bold text-white">{job.code}</h1>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${COLOR_CLASS[statusColor] ?? ''}`}>
            {JOB_STATUS_LABELS[job.status as JobStatus] ?? job.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePdf} className="flex items-center gap-1.5 text-xs border border-neutral-700 text-neutral-400 hover:text-violet-400 hover:border-violet-600 px-3 py-2 rounded-xl transition-colors">
            <Download size={13} /> PDF
          </button>
          {!isFinal && nextStatus && (
            <button disabled={changeStatus.isPending} onClick={handleAdvance} className="flex items-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-3 py-2 rounded-xl transition-colors">
              <CheckCircle size={13} /> {JOB_STATUS_LABELS[nextStatus]}
            </button>
          )}
          {!isFinal && (
            <button onClick={() => setShowCancel(true)} className="flex items-center gap-1.5 text-xs border border-red-800 text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-xl transition-colors">
              <XCircle size={13} /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Status progress bar */}
      {!isFinal && (
        <div className="flex items-center gap-1">
          {STATUS_FLOW.map((s, i) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= currentIdx ? 'bg-violet-500' : 'bg-neutral-800'}`} />
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-neutral-800 gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${tab === t.id ? 'border-violet-500 text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Dados */}
      {tab === 'dados' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 grid grid-cols-2 gap-4">
          {[
            { label: 'Cliente', value: job.clientName },
            { label: 'Paciente', value: job.patientName },
            { label: 'Tipo de Prótese', value: job.prothesisType },
            { label: 'Material', value: job.material },
            { label: 'Cor', value: job.color },
            { label: 'Prazo', value: job.deadline ? new Date(job.deadline).toLocaleDateString('pt-BR') : '—' },
            { label: 'Total', value: (job.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
            { label: 'Criado em', value: new Date(job.createdAt).toLocaleDateString('pt-BR') },
            { label: 'Concluído em', value: job.completedAt ? new Date(job.completedAt).toLocaleDateString('pt-BR') : '—' },
            { label: 'Entregue em', value: job.deliveredAt ? new Date(job.deliveredAt).toLocaleDateString('pt-BR') : '—' },
          ].map(({ label, value }) => value && (
            <div key={label}>
              <p className="text-xs text-neutral-500 mb-0.5">{label}</p>
              <p className="text-sm text-white">{value}</p>
            </div>
          ))}
          {job.instructions && (
            <div className="col-span-2">
              <p className="text-xs text-neutral-500 mb-0.5">Instruções</p>
              <p className="text-sm text-neutral-300 whitespace-pre-wrap">{job.instructions}</p>
            </div>
          )}
          {job.cancelReason && (
            <div className="col-span-2">
              <p className="text-xs text-red-400 mb-0.5">Motivo do cancelamento</p>
              <p className="text-sm text-red-300">{job.cancelReason}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Itens */}
      {tab === 'itens' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="text-left text-xs font-semibold text-neutral-500 px-5 py-3">Serviço</th>
                <th className="text-center text-xs font-semibold text-neutral-500 px-5 py-3">Qtd</th>
                <th className="text-right text-xs font-semibold text-neutral-500 px-5 py-3">Preço Unit.</th>
                <th className="text-right text-xs font-semibold text-neutral-500 px-5 py-3">Ajuste</th>
                <th className="text-right text-xs font-semibold text-neutral-500 px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {job.items.map((item, i) => (
                <tr key={item.id} className={i < job.items.length - 1 ? 'border-b border-neutral-800/50' : ''}>
                  <td className="px-5 py-3.5 text-sm text-white">{item.serviceNameSnapshot}</td>
                  <td className="px-5 py-3.5 text-center text-sm text-neutral-400">{item.quantity}</td>
                  <td className="px-5 py-3.5 text-right text-sm text-neutral-400">{(item.unitPriceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="px-5 py-3.5 text-right text-sm text-neutral-400">{item.adjustmentPercent}%</td>
                  <td className="px-5 py-3.5 text-right text-sm text-violet-400 font-semibold">{(item.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-800">
                <td colSpan={4} className="px-5 py-3 text-right text-sm font-semibold text-neutral-300">Total</td>
                <td className="px-5 py-3 text-right text-sm font-bold text-violet-400">{(job.totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Tab: Timeline */}
      {tab === 'timeline' && (
        <div className="space-y-3">
          {job.logs.map((log, i) => (
            <div key={log.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-violet-500' : 'bg-neutral-700'}`} />
                {i < job.logs.length - 1 && <div className="w-px flex-1 bg-neutral-800 mt-1" />}
              </div>
              <div className="pb-4">
                <p className="text-sm text-white font-medium">
                  {log.fromStatus ? `${JOB_STATUS_LABELS[log.fromStatus as JobStatus] ?? log.fromStatus} → ${JOB_STATUS_LABELS[log.toStatus as JobStatus] ?? log.toStatus}` : `Status inicial: ${JOB_STATUS_LABELS[log.toStatus as JobStatus] ?? log.toStatus}`}
                </p>
                {log.notes && <p className="text-xs text-neutral-400 mt-0.5">{log.notes}</p>}
                <p className="text-xs text-neutral-600 mt-0.5">{new Date(log.createdAt).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Fotos */}
      {tab === 'fotos' && (
        <div>
          {job.photos.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-neutral-500">
              <Camera size={32} />
              <p className="text-sm">Nenhuma foto registrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {job.photos.map(photo => (
                <div key={photo.id} className="aspect-square bg-neutral-800 rounded-xl overflow-hidden">
                  <img src={photo.url} alt={photo.description ?? 'Foto da OS'} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cancel modal */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-white font-semibold">Cancelar OS {job.code}?</h2>
            <div>
              <label className="block text-xs text-neutral-400 mb-1.5">Motivo do cancelamento *</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} className="input-field w-full resize-none" autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCancel(false)} className="flex-1 py-2.5 rounded-xl border border-neutral-700 text-neutral-400 text-sm hover:bg-neutral-800 transition-colors">Voltar</button>
              <button disabled={!cancelReason.trim() || changeStatus.isPending} onClick={handleCancel} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {changeStatus.isPending ? 'Cancelando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
