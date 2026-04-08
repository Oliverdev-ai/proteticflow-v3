import { useMemo, useState } from 'react';
import { ChevronDown, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import { trpc } from '../../lib/trpc';
import { NotificationPopover } from './notification-popover';
import { TenantSwitcher } from './tenant-switcher';
import { useTheme } from '../shared/theme-provider';
import { NAV_ITEMS } from './navigation';
import { usePermissions } from '../../hooks/use-permissions';

type HeaderProps = {
  onToggleMobileSidebar: () => void;
  onToggleSidebar: () => void;
};

export function Header({ onToggleMobileSidebar, onToggleSidebar }: HeaderProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { hasAccess } = usePermissions();
  const { data: profile } = trpc.auth.getProfile.useQuery();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');

  const searchHits = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (value.length < 2) return [];

    return NAV_ITEMS.filter((item) => hasAccess(item.module)).filter((item) => {
      const haystack = [item.label, item.href, ...(item.keywords ?? [])].join(' ').toLowerCase();
      return haystack.includes(value);
    }).slice(0, 6);
  }, [hasAccess, query]);

  const goTo = (path: string) => {
    navigate(path);
    setQuery('');
  };

  return (
    <header className="sticky top-0 h-14 bg-background/60 backdrop-blur-xl border-b border-border flex items-center px-3 md:px-6 gap-3 relative z-30 transition-all duration-300">
      <button
        onClick={onToggleMobileSidebar}
        className="lg:hidden h-9 w-9 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex items-center justify-center active:scale-95"
        aria-label="Abrir menu"
      >
        <Menu size={18} />
      </button>

      <button
        onClick={onToggleSidebar}
        className="hidden lg:flex h-9 w-9 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all items-center justify-center active:scale-95"
        aria-label="Expandir/recolher sidebar"
      >
        <Menu size={18} />
      </button>

      <div className="hidden md:block">
        <TenantSwitcher />
      </div>

      <div className="flex-1 max-w-lg relative group">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchHits[0]) {
              e.preventDefault();
              goTo(searchHits[0].href);
            }
          }}
          placeholder="Busca rápida (Alt + K)"
          className="w-full bg-muted/30 border border-border/50 rounded-xl py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 transition-all outline-none focus:bg-background focus:border-primary/50 focus:ring-4 focus:ring-primary/10 shadow-sm"
        />
        {searchHits.length > 0 && (
          <div className="absolute top-full mt-2 w-full rounded-lg border border-border bg-card shadow-xl overflow-hidden">
            {searchHits.map((item) => (
              <button
                key={item.href}
                onClick={() => goTo(item.href)}
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
              >
                {item.label}
                <span className="ml-2 text-xs text-muted-foreground">{item.href}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={toggleTheme}
        className="h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center"
        aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <NotificationPopover />

      <div className="hidden md:flex items-center gap-2.5 px-2 py-1 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer group">
        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold uppercase transition-transform group-hover:scale-105">
          {profile?.name?.[0] ?? '?'}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground max-w-[120px] truncate leading-none mb-0.5">
            {profile?.name}
          </span>
          <span className="text-[10px] text-muted-foreground leading-none">Administrador</span>
        </div>
        <ChevronDown size={14} className="text-muted-foreground transition-transform group-hover:translate-y-0.5" />
      </div>

      <button
        onClick={() => {
          void logout();
        }}
        className="h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:bg-secondary transition-colors flex items-center justify-center"
        title="Sair"
      >
        <LogOut size={16} />
      </button>
    </header>
  );
}
