import { useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ChevronLeft,
  LogOut,
  Sparkles,
  LayoutDashboard,
} from 'lucide-react';
import { usePermissions } from '../../hooks/use-permissions';
import { useLocalStorage } from '../../hooks/use-local-storage';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../hooks/use-auth';
import { cn } from '../../lib/utils';
import {
  NAV_DASHBOARD,
  NAV_GROUPS,
  NAV_FLOW_IA,
  type NavGroup,
  type NavItem,
} from './navigation';

/* ─── constantes de dimensão ──────────────────────────────── */
const W_EXPANDED  = 256; // px
const W_COLLAPSED =  72; // px

/* ─── helpers ─────────────────────────────────────────────── */
function getInitials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
  }
  return (parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

/* ─── NavItemRow ───────────────────────────────────────────── */
function NavItemRow({
  item,
  collapsed,
  nested = false,
}: {
  item: NavItem;
  collapsed: boolean;
  nested?: boolean;
}) {
  const Icon = item.icon;
  const itemPath = item.href.split('?')[0] ?? item.href;
  const isDashboard = itemPath === '/';

  if (item.disabled) {
    return (
      <div
        title={item.disabledReason ?? 'Em breve'}
        className={cn(
          'group/item relative flex cursor-not-allowed items-center gap-3 rounded-lg text-[13px] font-medium opacity-50',
          collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2',
          nested && !collapsed ? 'pl-8' : '',
          'text-white/45',
        )}
        aria-disabled="true"
      >
        <Icon size={collapsed ? 17 : 15} className="shrink-0 text-white/35" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {collapsed && <span className="sr-only">{item.label}</span>}
      </div>
    );
  }

  return (
    <NavLink
      to={item.href}
      end={isDashboard}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group/item relative flex items-center gap-3 rounded-lg text-[13px] font-medium',
          'transition-colors duration-[80ms] outline-none',
          'focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50',
          collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'px-3 py-2',
          nested && !collapsed ? 'pl-8' : '',
          isActive
            ? [
                'text-[var(--primary)]',
                !collapsed && 'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2',
                !collapsed && 'before:h-5 before:w-[3px] before:rounded-r-full before:bg-[var(--primary)]',
              ]
            : [
                'text-white/55 hover:text-white/90',
                'hover:bg-white/[0.06]',
              ],
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={collapsed ? 17 : 15}
            className={cn(
              'shrink-0 transition-colors duration-[80ms]',
              isActive ? 'text-[var(--primary)]' : 'text-white/45 group-hover/item:text-white/75',
            )}
          />

          {/* dot indicator quando ativo + collapsed */}
          {isActive && collapsed && (
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
          )}
          {/* dot indicator quando ativo + expanded (lado direito) */}
          {isActive && !collapsed && (
            <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
          )}

          {!collapsed && <span className="truncate">{item.label}</span>}
          {collapsed && <span className="sr-only">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

/* ─── NavGroupSection ──────────────────────────────────────── */
const STORAGE_KEY_PREFIX = 'ptf-sidebar-group-';

function NavGroupSection({
  group,
  collapsed,
}: {
  group: NavGroup;
  collapsed: boolean;
}) {
  const { hasAccess } = usePermissions();
  const [open, setOpen] = useLocalStorage(`${STORAGE_KEY_PREFIX}${group.id}`, true);
  const { pathname } = useLocation();
  const Icon = group.icon;
  const visibleItems = group.items.filter((item) => item.disabled || hasAccess(item.module));

  if (visibleItems.length === 0) return null;

  const isAnyActive = visibleItems.some((item) => {
    const itemPath = item.href.split('?')[0] ?? item.href;
    return pathname === itemPath || (itemPath !== '/' && pathname.startsWith(`${itemPath}/`));
  });

  if (collapsed) {
    return (
      <div className="mx-1">
        <div
          title={group.label}
          className={cn(
            'flex justify-center items-center py-2 rounded-lg',
            'text-white/40 text-[10px] font-bold uppercase tracking-wider',
          )}
        >
          <Icon
            size={15}
            className={cn(
              'transition-colors duration-[80ms]',
              isAnyActive ? 'text-[var(--primary)]' : 'text-white/30',
            )}
          />
        </div>
        <div className="space-y-0.5">
          {visibleItems.map((item) => (
            <NavItemRow key={item.href} item={item} collapsed={collapsed} nested />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
          'text-white/35 text-[10px] font-bold uppercase tracking-[0.12em]',
          'hover:text-white/55 hover:bg-white/[0.04] transition-colors duration-[80ms]',
          'outline-none focus-visible:ring-1 focus-visible:ring-white/20',
        )}
        aria-expanded={open}
      >
        <Icon size={13} />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          size={12}
          className={cn(
            'transition-transform duration-200',
            open ? 'rotate-0' : '-rotate-90',
          )}
        />
      </button>

      {open && (
        <div className="space-y-0.5 mt-0.5">
          {visibleItems.map((item) => (
            <NavItemRow key={item.href} item={item} collapsed={false} nested />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── SidebarContent ───────────────────────────────────────── */
function SidebarContent({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { hasAccess } = usePermissions();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { data: profile } = trpc.auth.getProfile.useQuery();
  const { data: licenseStatus } = trpc.licensing.getStatus.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });

  const width = collapsed ? W_COLLAPSED : W_EXPANDED;
  const plan = licenseStatus?.plan?.toUpperCase() ?? null;

  const handleFlowIa = useCallback(() => {
    if (hasAccess(NAV_FLOW_IA.module)) navigate(NAV_FLOW_IA.href);
  }, [hasAccess, navigate]);

  return (
    <aside
      style={{
        width,
        minWidth: width,
        backgroundColor: 'var(--shell-sidebar-bg)',
      }}
      className="h-full flex flex-col transition-all duration-200 border-r border-white/[0.06] overflow-hidden"
    >
      {/* ── Top: logo ──────────────────────────────────────── */}
      <div
        className={cn(
          'flex items-center h-14 shrink-0 border-b border-white/[0.06]',
          collapsed ? 'justify-center px-3' : 'px-4 gap-2.5',
        )}
      >
        <img
          src="/brand/logo-mark.svg"
          alt="ProteticFlow"
          width={collapsed ? 28 : 24}
          height={collapsed ? 28 : 24}
          className="shrink-0"
          onError={(e) => {
            // fallback: oculta a imagem quebrada se o svg não existir ainda
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {!collapsed && (
          <span
            className="text-white/90 font-semibold text-[15px] tracking-tight leading-none"
            style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
          >
            ProteticFlow
          </span>
        )}
      </div>

      {/* ── Nav: Dashboard + 7 grupos ──────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-1.5 space-y-0.5">

        {/* Dashboard solo */}
        {hasAccess(NAV_DASHBOARD.module) && (
          <div className={cn(collapsed ? 'mx-1' : '')}>
            <NavLink
              to={NAV_DASHBOARD.href}
              end
              title={collapsed ? NAV_DASHBOARD.label : undefined}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-3 rounded-lg text-[13px] font-semibold',
                  'transition-colors duration-[80ms] outline-none mb-2',
                  'focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50',
                  collapsed ? 'justify-center px-0 py-2.5 mx-0' : 'px-3 py-2',
                  isActive
                    ? [
                        'text-[var(--primary)]',
                        !collapsed && 'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2',
                        !collapsed && 'before:h-5 before:w-[3px] before:rounded-r-full before:bg-[var(--primary)]',
                      ]
                    : 'text-white/60 hover:text-white/90 hover:bg-white/[0.06]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <LayoutDashboard
                    size={collapsed ? 17 : 15}
                    className={cn(
                      'shrink-0 transition-colors duration-[80ms]',
                      isActive ? 'text-[var(--primary)]' : 'text-white/45',
                    )}
                  />
                  {!collapsed && <span>Dashboard</span>}
                  {collapsed && isActive && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                  )}
                  {!collapsed && isActive && (
                    <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                  )}
                </>
              )}
            </NavLink>
          </div>
        )}

        {/* divisor sutil */}
        <div className="h-px bg-white/[0.06] mx-3 my-1" />

        {/* 7 grupos */}
        {NAV_GROUPS.map((group) => (
          <NavGroupSection key={group.id} group={group} collapsed={collapsed} />
        ))}
      </nav>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/[0.06] p-2 space-y-1.5">

        {/* Flow IA CTA */}
        {hasAccess(NAV_FLOW_IA.module) && (
          <button
            onClick={handleFlowIa}
            title={collapsed ? 'Flow IA' : undefined}
            className={cn(
              'w-full flex items-center rounded-lg text-[13px] font-semibold',
              'bg-[var(--primary)]/15 hover:bg-[var(--primary)]/25',
              'text-[var(--primary)] transition-colors duration-[80ms]',
              'outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50',
              collapsed ? 'justify-center py-2.5' : 'gap-2.5 px-3 py-2',
            )}
          >
            <Sparkles size={16} className="shrink-0" />
            {!collapsed && <span>Flow IA</span>}
          </button>
        )}

        {/* User profile */}
        <div
          className={cn(
            'flex items-center rounded-lg',
            collapsed ? 'justify-center py-2' : 'gap-2.5 px-2 py-1.5',
          )}
        >
          <div
            className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
            }}
          >
            {getInitials(profile?.name)}
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-white/85 text-[13px] font-medium truncate leading-tight">
                  {profile?.name ?? '—'}
                </p>
                {plan && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)' }}
                  >
                    {plan}
                  </span>
                )}
              </div>

              <button
                onClick={() => void logout()}
                title="Sair"
                className="ml-auto h-7 w-7 flex items-center justify-center rounded-md text-white/35 hover:text-red-400 hover:bg-white/[0.06] transition-colors duration-[80ms]"
                aria-label="Sair da conta"
              >
                <LogOut size={14} />
              </button>
            </>
          )}
        </div>

        {/* Botão recolher — desktop only */}
        <button
          onClick={onToggleCollapse}
          className={cn(
            'hidden lg:flex w-full items-center justify-center gap-1.5 h-7 rounded-lg',
            'text-white/25 hover:text-white/50 hover:bg-white/[0.05]',
            'text-[11px] transition-colors duration-[80ms]',
            'outline-none focus-visible:ring-1 focus-visible:ring-white/20',
          )}
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
        >
          <ChevronLeft
            size={14}
            className={cn('transition-transform duration-200', collapsed && 'rotate-180')}
          />
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}

/* ─── Sidebar (export público) ─────────────────────────────── */
export type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
};

export function Sidebar({ collapsed, mobileOpen, onCloseMobile, onToggleCollapse }: SidebarProps) {
  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:block h-screen sticky top-0">
        <SidebarContent collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
          />
          <div className="absolute left-0 top-0 bottom-0 z-50">
            <SidebarContent collapsed={false} onToggleCollapse={onCloseMobile} />
          </div>
        </div>
      )}
    </>
  );
}
