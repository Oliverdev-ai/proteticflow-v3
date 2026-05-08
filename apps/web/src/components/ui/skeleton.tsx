import { cn } from '../../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rect' | 'circle' | 'avatar';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({ variant = 'rect', width, height, lines = 1, className, style, ...props }: SkeletonProps) {
  const shimmer = [
    'relative overflow-hidden',
    'bg-[var(--bg-subtle)]',
    'before:absolute before:inset-0',
    'before:bg-gradient-to-r before:from-transparent before:via-[var(--bg-muted)] before:to-transparent',
    'before:animate-[shimmer_1.6s_ease-in-out_infinite]',
  ].join(' ');

  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('flex flex-col gap-2', className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(shimmer, 'h-3 rounded-[var(--radius-xs)]')}
            style={{ width: i === lines - 1 ? '72%' : '100%' }}
          />
        ))}
      </div>
    );
  }

  const variantStyles: Record<NonNullable<SkeletonProps['variant']>, string> = {
    text:   'h-3 rounded-[var(--radius-xs)]',
    rect:   'rounded-[var(--radius-md)]',
    circle: 'rounded-full',
    avatar: 'rounded-full',
  };

  return (
    <div
      className={cn(shimmer, variantStyles[variant], className)}
      style={{
        width: width ?? (variant === 'circle' || variant === 'avatar' ? '2.25rem' : '100%'),
        height: height ?? (variant === 'circle' || variant === 'avatar' ? '2.25rem' : variant === 'text' ? '0.75rem' : '1rem'),
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-md)] p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton variant="avatar" width={36} height={36} />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </div>
      </div>
      <Skeleton variant="text" lines={3} />
      <Skeleton variant="rect" height={32} />
    </div>
  );
}
