import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/use-auth';
import { TenantSwitcher } from './tenant-switcher';
import { trpc } from '../../lib/trpc';
import { NotificationPopover } from './notification-popover';

export function Header() {
  const { user, logout } = useAuth();
  const { data: profile } = trpc.auth.getProfile.useQuery();

  return (
    <header className="h-14 bg-neutral-900 border-b border-neutral-800 flex items-center px-5 gap-4">
      <div className="flex-1">
        <TenantSwitcher />
      </div>

      <NotificationPopover />

      <div className="flex items-center gap-2 text-sm">
        <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white text-xs font-semibold uppercase">
          {profile?.name?.[0] ?? '?'}
        </div>
        <span className="text-neutral-300 max-w-[120px] truncate">{profile?.name ?? user?.email}</span>
        <ChevronDown size={14} className="text-neutral-500" />
      </div>

      <button
        onClick={() => { void logout(); }}
        className="text-neutral-500 hover:text-red-400 transition-colors"
        title="Sair"
      >
        <LogOut size={16} />
      </button>
    </header>
  );
}
