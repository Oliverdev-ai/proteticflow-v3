import { LucideIcon, Files } from 'lucide-react';
import { cn } from '../../lib/utils';
import { H3, Muted } from './typography';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Files,
  title,
  description,
  children,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6 text-center animate-in fade-in zoom-in duration-300",
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 ring-8 ring-primary/5">
        <Icon className="h-8 w-8" />
      </div>
      
      <H3 className="mb-2">{title}</H3>
      
      {description && (
        <Muted className="max-w-[280px] mb-8">
          {description}
        </Muted>
      )}
      
      {children && (
        <div className="mt-2">
          {children}
        </div>
      )}
    </div>
  );
}

export function EmptyTable({
  title = "Nenhum resultado encontrado",
  description = "Tente ajustar seus filtros ou cadastre um novo item para começar.",
  ...props
}: Partial<EmptyStateProps>) {
  return (
    <div className="w-full flex justify-center py-20 border-2 border-dashed border-border/50 rounded-2xl bg-card/30 backdrop-blur-sm">
      <EmptyState title={title} description={description} {...props} />
    </div>
  );
}
