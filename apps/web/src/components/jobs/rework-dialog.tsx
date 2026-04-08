import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Wrench, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ReworkJobOption = {
  id: number;
  code: string;
  patientName?: string | null;
  clientName?: string | null;
  firstItemName?: string;
};

export type ReworkDialogInput = {
  originalJobId: number;
  reason: string;
  deadline: string;
};

type ReworkDialogProps = {
  open: boolean;
  jobs: ReworkJobOption[];
  defaultOriginalJobId?: number;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (input: ReworkDialogInput) => Promise<void> | void;
};

function defaultDeadlineIso(daysAhead: number): string {
  const next = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return next.toISOString().slice(0, 10);
}

export function ReworkDialog({
  open,
  jobs,
  defaultOriginalJobId,
  isSubmitting = false,
  onClose,
  onConfirm,
}: ReworkDialogProps) {
  const [selectedId, setSelectedId] = useState<number | null>(defaultOriginalJobId ?? null);
  const [reason, setReason] = useState('');
  const [deadline, setDeadline] = useState(defaultDeadlineIso(3));

  useEffect(() => {
    if (!open) return;
    setSelectedId(defaultOriginalJobId ?? jobs[0]?.id ?? null);
    setReason('');
    setDeadline(defaultDeadlineIso(3));
  }, [defaultOriginalJobId, jobs, open]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedId) ?? null,
    [jobs, selectedId],
  );

  if (!open) return null;

  const canSubmit = Boolean(selectedId && reason.trim().length >= 3 && deadline);

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <Wrench size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground">Criar Remoldagem</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Nova OS filha vinculada à OS original
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted text-muted-foreground transition-all hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              OS original
            </label>
            <select
              value={selectedId ?? ''}
              onChange={(event) => setSelectedId(Number(event.target.value))}
              className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
            >
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.code} - {job.patientName ?? 'Paciente não informado'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Novo prazo
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Motivo
            </label>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: ajuste de mordida"
              className="w-full rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm font-semibold text-foreground outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5"
            />
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
          {selectedJob ? (
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Preview
              </p>
              <p className="text-sm font-black text-foreground">{selectedJob.code}</p>
              <p className="text-xs font-semibold text-muted-foreground">
                {selectedJob.clientName ?? 'Cliente não informado'} -{' '}
                {selectedJob.patientName ?? 'Paciente não informado'}
              </p>
              {selectedJob.firstItemName ? (
                <p className="text-[11px] font-semibold text-muted-foreground">{selectedJob.firstItemName}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={14} />
              <p className="text-xs font-semibold">Selecione uma OS original para continuar.</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-border bg-muted px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground transition-all hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={() => {
              if (!selectedId) return;
              void onConfirm({
                originalJobId: selectedId,
                reason: reason.trim(),
                deadline: new Date(`${deadline}T12:00:00`).toISOString(),
              });
            }}
            className={cn(
              'flex flex-[1.5] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all',
              'bg-amber-500 text-black shadow-lg shadow-amber-500/20 hover:brightness-105 disabled:opacity-40',
            )}
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Confirmar remoldagem
          </button>
        </div>
      </div>
    </div>
  );
}

