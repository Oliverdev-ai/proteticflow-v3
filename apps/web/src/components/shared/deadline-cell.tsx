import { differenceInHours, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { JobStatus } from '@proteticflow/shared';
import { cn } from '../../lib/utils';

interface DeadlineCellProps {
  deadline: Date;
  status: JobStatus;
}

const FINAL_STATUSES: JobStatus[] = ['delivered', 'cancelled', 'suspended'];

export function DeadlineCell({ deadline, status }: DeadlineCellProps) {
  const diffHours = differenceInHours(deadline, new Date());
  const isOverdue = diffHours < 0 && !FINAL_STATUSES.includes(status);
  const isSoon = diffHours >= 0 && diffHours < 24 && !FINAL_STATUSES.includes(status);

  const color = isOverdue ? 'text-destructive' : isSoon ? 'text-warning' : 'text-foreground';
  const label = isOverdue ? 'atrasado' : isSoon ? 'em breve' : null;

  return (
    <div className={cn('flex flex-col items-end', color)}>
      <span className="t-small tabular-nums">{format(deadline, 'dd/MM/yy', { locale: ptBR })}</span>
      {label ? <span className="t-micro">{label}</span> : null}
    </div>
  );
}
