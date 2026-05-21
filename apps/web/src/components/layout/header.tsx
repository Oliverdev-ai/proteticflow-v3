import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  CreditCard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import { trpc } from '../../lib/trpc';
import { NotificationPopover } from './notification-popover';
import { TenantSwitcher } from './tenant-switcher';
import { useTheme } from '../shared/theme-provider';
import { NAV_ALL_ITEMS } from './navigation';
import { usePermissions } from '../../hooks/use-permissions';
import { cn } from '../../lib/utils';
import type { ThemeMode } from '../shared/theme-provider';

/* ─── Theme cycle ──────────────────────────────────────────── */
const THEME_CYCLE: ThemeMode[] = ['light', 'dark', 'system'];
const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Tema claro',
  dark: 'Tema escuro',
  system: 'Seguir sistema',
};

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'dark') return <Moon size={16} />;
  if (mode === 'light') return <Sun size={16} />;
  return <Monitor size={16} />;
}

function getInitials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

/* ─── UserMenu ─────────────────────────────────────────────── */
function UserMenu({
  name,
  plan,
  onLogout,
}: {
  name?: string | null;
  plan?: string | null;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const planLabel = plan
    ? plan.charAt(0).toUpperCase() + plan.slice(1)
    : null;

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/60 transition-colors duration-[80ms] outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <div className="h-7 w-7 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30 flex items-center justify-center text-[11px] font-bold">
          {getInitials(name)}
        </div>
        <div className="flex flex-col items-start">
          <span className="text-[13px] font-semibold text-foreground max-w-[120px] truncate leading-none mb-0.5">
            {name ?? '—'}
          </span>
          {planLabel && (
            <span className="text-[9px] font-bold uppercase tracking-normal text-[var(--primary)]">
              {planLabel}
            </span>
          )}
        </div>
        <ChevronDown
          size={13}
          className={cn('text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden py-1"
        >
          <button
            role="menuitem"
            onClick={() => { navigate('/configuracoes'); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-secondary transition-colors"
          >
            <Settings size={14} className="text-muted-foreground" />
            Configurações
          </button>
          <button
            role="menuitem"
            onClick={() => { navigate('/planos'); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-secondary transition-colors"
          >
            <CreditCard size={14} className="text-muted-foreground" />
            Plano
            {planLabel && (
              <span className="ml-auto text-[9px] font-bold uppercase tracking-normal text-[var(--primary)]">
                {planLabel}
              </span>
            )}
          </button>
          <div className="h-px bg-border my-1" />
          <button
            role="menuitem"
            onClick={() => { onLogout(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-secondary hover:text-red-500 transition-colors"
          >
            <LogOut size={14} className="text-muted-foreground" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Header ───────────────────────────────────────────────── */
type HeaderProps = {
  onToggleMobileSidebar: () => void;
  onToggleSidebar: () => void;
};

export function Header({ onToggleMobileSidebar, onToggleSidebar }: HeaderProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { hasAccess } = usePermissions();
  const { data: profile } = trpc.auth.getProfile.useQuery();
  const { data: licenseStatus } = trpc.licensing.getStatus.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const { mode, setMode } = useTheme();
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  /* Alt+K → foca a busca */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  /* Ciclo de tema: light → dark → system → light */
  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(mode);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length] ?? 'light';
    setMode(next);
  };

  /* Busca global nos nav items */
  const searchHits = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (value.length < 2) return [];
    return NAV_ALL_ITEMS
      .filter((item) => hasAccess(item.module))
      .filter((item) => {
        const haystack = [item.label, item.href, ...(item.keywords ?? [])].join(' ').toLowerCase();
        return haystack.includes(value);
      })
      .slice(0, 6);
  }, [hasAccess, query]);

  const goTo = (path: string) => {
    navigate(path);
    setQuery('');
    searchRef.current?.blur();
  };

  return (
    <header className="sticky top-0 h-14 bg-background/80 backdrop-blur-xl border-b border-border flex items-center px-3 md:px-5 gap-2.5 relative z-30">

      {/* Hambúrguer mobile */}
      <button
        onClick={onToggleMobileSidebar}
        className="lg:hidden h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center"
        aria-label="Abrir menu"
      >
        <Menu size={18} />
      </button>

      {/* Toggle sidebar desktop */}
      <button
        onClick={onToggleSidebar}
        className="hidden lg:flex h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors items-center justify-center"
        aria-label="Expandir/recolher sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Tenant switcher */}
      <div className="hidden md:block">
        <TenantSwitcher />
      </div>

      {/* Busca global */}
      <div className="flex-1 max-w-md relative group">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 group-focus-within:text-[var(--primary)] transition-colors pointer-events-none"
        />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchHits[0]) { e.preventDefault(); goTo(searchHits[0].href); }
            if (e.key === 'Escape') { setQuery(''); searchRef.current?.blur(); }
          }}
          placeholder="Buscar… (Alt + K)"
          className={cn(
            'w-full bg-muted/30 border border-border/60 rounded-lg py-2 pl-9 pr-3',
            'text-[13px] text-foreground placeholder:text-muted-foreground/40',
            'transition-all duration-150 outline-none',
            'focus:bg-background focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/10',
          )}
        />

        {searchHits.length > 0 && (
          <div className="absolute top-full mt-1.5 w-full rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden">
            {searchHits.map((item) => (
              <button
                key={item.href}
                onClick={() => goTo(item.href)}
                className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:bg-secondary transition-colors flex items-center justify-between"
              >
                <span>{item.label}</span>
                <span className="text-[11px] text-muted-foreground font-mono">{item.href}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Espaço flex */}
      <div className="flex-1" />

      {/* Theme toggle — cicla system/light/dark */}
      <button
        onClick={cycleTheme}
        title={THEME_LABELS[mode]}
        className="h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center"
        aria-label={THEME_LABELS[mode]}
      >
        <ThemeIcon mode={mode} />
      </button>

      {/* Notificações (1 único bell) */}
      <NotificationPopover />

      {/* User menu */}
      <UserMenu
        name={profile?.name ?? null}
        plan={licenseStatus?.plan ?? null}
        onLogout={() => void logout()}
      />
    </header>
  );
}
