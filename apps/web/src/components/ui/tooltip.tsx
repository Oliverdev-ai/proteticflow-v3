import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: React.ReactNode;
  side?: TooltipSide;
  delay?: number;
  children: React.ReactElement;
  disabled?: boolean;
}

const sideStyles: Record<TooltipSide, { tooltip: string; arrow: string }> = {
  top:    { tooltip: 'bottom-full left-1/2 -translate-x-1/2 mb-2',   arrow: 'top-full left-1/2 -translate-x-1/2 border-t-[var(--ink-700)] border-t-4 border-x-4 border-x-transparent border-b-0' },
  bottom: { tooltip: 'top-full left-1/2 -translate-x-1/2 mt-2',    arrow: 'bottom-full left-1/2 -translate-x-1/2 border-b-[var(--ink-700)] border-b-4 border-x-4 border-x-transparent border-t-0' },
  left:   { tooltip: 'right-full top-1/2 -translate-y-1/2 mr-2',    arrow: 'left-full top-1/2 -translate-y-1/2 border-l-[var(--ink-700)] border-l-4 border-y-4 border-y-transparent border-r-0' },
  right:  { tooltip: 'left-full top-1/2 -translate-y-1/2 ml-2',     arrow: 'right-full top-1/2 -translate-y-1/2 border-r-[var(--ink-700)] border-r-4 border-y-4 border-y-transparent border-l-0' },
};

export function Tooltip({ content, side = 'top', delay = 400, children, disabled = false }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const id = useRef(`tooltip-${Math.random().toString(36).slice(2)}`).current;

  const show = () => {
    if (disabled) return;
    timerRef.current = setTimeout(() => setVisible(true), delay);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const s = sideStyles[side];

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {/* Clone child to attach aria-describedby */}
      {visible
        ? { ...children, props: { ...children.props, 'aria-describedby': id } }
        : children}

      {visible && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'absolute z-50 pointer-events-none',
            'px-2.5 py-1.5 rounded-[var(--radius-sm)]',
            'bg-[var(--ink-700)] text-[var(--navy-fg)] text-[0.75rem] font-medium whitespace-nowrap',
            'shadow-[var(--shadow-md)]',
            'animate-in fade-in-0 zoom-in-95 duration-[var(--dur-fast)]',
            s.tooltip,
          )}
        >
          {content}
          <span className={cn('absolute w-0 h-0', s.arrow)} aria-hidden />
        </span>
      )}
    </span>
  );
}
