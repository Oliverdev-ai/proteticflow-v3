import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type SuspendDialogProps = {
  open: boolean;
  title?: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
};

export function SuspendDialog({
  open,
  title = 'Suspender OS',
  isSubmitting = false,
  onClose,
  onConfirm,
}: SuspendDialogProps) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  if (!open) return null;

  const isValid = reason.trim().length >= 3;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-foreground">{title}</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Motivo obrigatório (mínimo 3 caracteres)
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

        <textarea
          autoFocus
          rows={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Ex.: aguardando material do fornecedor"
          className={cn(
            'w-full resize-none rounded-2xl border bg-muted/50 px-4 py-3 text-sm font-semibold text-foreground outline-none transition-all',
            'border-border placeholder:text-muted-foreground/40 focus:border-primary/40 focus:ring-4 focus:ring-primary/5',
          )}
        />

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
            disabled={!isValid || isSubmitting}
            onClick={() => void onConfirm(reason.trim())}
            className="flex flex-[1.5] items-center justify-center gap-2 rounded-2xl bg-destructive px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-destructive-foreground shadow-lg shadow-destructive/20 transition-all hover:brightness-110 disabled:opacity-40"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Confirmar suspensão
          </button>
        </div>
      </div>
    </div>
  );
}

