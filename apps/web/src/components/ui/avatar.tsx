import { cn } from '../../lib/utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  online?: boolean;
}

const sizeStyles: Record<AvatarSize, { wrap: string; text: string; ring: string; dot: string }> = {
  xs: { wrap: 'size-6 text-[0.625rem]', text: 'font-semibold',  ring: 'ring-1',  dot: 'size-1.5 -bottom-0.5 -right-0.5' },
  sm: { wrap: 'size-8 text-[0.75rem]',  text: 'font-semibold',  ring: 'ring-1',  dot: 'size-2 bottom-0 right-0' },
  md: { wrap: 'size-9 text-[0.875rem]', text: 'font-medium',   ring: 'ring-2',  dot: 'size-2.5 bottom-0 right-0' },
  lg: { wrap: 'size-11 text-[1rem]',    text: 'font-medium',   ring: 'ring-2',  dot: 'size-3 bottom-0.5 right-0.5' },
  xl: { wrap: 'size-14 text-[1.25rem]', text: 'font-medium',   ring: 'ring-2',  dot: 'size-3.5 bottom-1 right-1' },
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ src, alt, name, size = 'md', online, className, ...props }: AvatarProps) {
  const s = sizeStyles[size];
  const initials = name ? getInitials(name) : '?';

  return (
    <span className={cn('relative inline-flex shrink-0', s.wrap, className)} {...props}>
      {src ? (
        <img
          src={src}
          alt={alt ?? name ?? 'Avatar'}
          className={cn('w-full h-full object-cover rounded-full', s.ring, 'ring-[var(--border)]')}
        />
      ) : (
        <span
          className={cn(
            'w-full h-full rounded-full flex items-center justify-center',
            'bg-[var(--navy-700)] text-[var(--navy-fg)]',
            s.text,
            'font-[var(--font-sans)] tracking-[var(--tracking-wide)] select-none',
          )}
          aria-label={name ?? 'Avatar'}
        >
          {initials}
        </span>
      )}
      {online !== undefined && (
        <span
          aria-label={online ? 'Online' : 'Offline'}
          className={cn(
            'absolute rounded-full border-2 border-[var(--bg-elevated)]',
            s.dot,
            online ? 'bg-[var(--success)]' : 'bg-[var(--fg-subtle)]',
          )}
        />
      )}
    </span>
  );
}
