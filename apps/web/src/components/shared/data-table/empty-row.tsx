import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyRowProps {
  colSpan: number;
  title: string;
  description?: string;
  cta?: ReactNode;
  icon?: ReactNode;
}

export function EmptyRow({ colSpan, title, description, cta, icon }: EmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-muted-foreground/40">{icon ?? <Inbox size={32} aria-hidden="true" />}</span>
          <p className="t-small font-medium text-foreground">{title}</p>
          {description ? <p className="t-micro text-muted-foreground">{description}</p> : null}
          {cta ? <div className="mt-2">{cta}</div> : null}
        </div>
      </td>
    </tr>
  );
}
