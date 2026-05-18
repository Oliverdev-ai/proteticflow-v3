import { cloneElement, useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

export interface DropdownItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  separator?: never;
}

export interface DropdownSeparator {
  key: string;
  separator: true;
  label?: never;
}

export type DropdownOption = DropdownItem | DropdownSeparator;

type DropdownTriggerProps = React.AriaAttributes & {
  onClick?: React.MouseEventHandler<HTMLElement>;
};

export interface DropdownProps {
  trigger: React.ReactElement<DropdownTriggerProps>;
  items: DropdownOption[];
  onSelect?: (key: string) => void;
  align?: 'start' | 'end';
  width?: number;
}

export function Dropdown({ trigger, items, onSelect, align = 'start', width = 200 }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef(`dd-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex">
      {cloneElement(trigger, {
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': id,
        onClick: (e: React.MouseEvent<HTMLElement>) => {
          setOpen((v) => !v);
          trigger.props.onClick?.(e);
        },
      })}

      {open && (
        <div
          id={id}
          role="menu"
          style={{ width }}
          className={cn(
            'absolute z-50 top-full mt-1.5',
            'bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-md)]',
            'shadow-[var(--shadow-md)] py-1',
            'animate-in fade-in-0 zoom-in-95 duration-[var(--dur-fast)]',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) =>
            'separator' in item ? (
              <div key={item.key} role="separator" className="my-1 border-t border-[var(--border)]" />
            ) : (
              <button
                key={item.key}
                role="menuitem"
                disabled={item.disabled}
                onClick={() => { onSelect?.(item.key); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-left text-[0.875rem]',
                  'transition-colors duration-[var(--dur-instant)]',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  item.destructive
                    ? 'text-[var(--destructive)] hover:bg-[var(--destructive-soft)]'
                    : 'text-[var(--fg)] hover:bg-[var(--bg-subtle)] hover:text-[var(--fg-strong)]',
                )}
              >
                {item.icon && (
                  <span className="size-4 shrink-0 opacity-70" aria-hidden>{item.icon}</span>
                )}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
