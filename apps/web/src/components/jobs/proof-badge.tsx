import { cn } from '../../lib/utils';

type ProofBadgeProps = {
  className?: string;
  proofDueDate?: Date | string | null | undefined;
  proofReturnedAt?: Date | string | null | undefined;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function ProofBadge({ className, proofDueDate, proofReturnedAt }: ProofBadgeProps) {
  const due = toDate(proofDueDate);
  const returned = toDate(proofReturnedAt);
  const isOverdue = Boolean(due && !returned && due.getTime() < Date.now());

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest',
        isOverdue
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-sky-500/40 bg-sky-500/10 text-sky-600',
        className,
      )}
      title={isOverdue ? 'Prova em atraso' : 'OS em prova'}
    >
      PROVA
    </span>
  );
}
