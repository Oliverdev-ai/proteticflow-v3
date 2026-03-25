import { useMemo, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';

export function NotificationPopover() {
  const [open, setOpen] = useState(false);

  const { data: unreadCount = 0 } = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 20_000,
  });
  const listQuery = trpc.notification.list.useQuery(
    { unreadOnly: false, limit: 20 },
    { enabled: open },
  );
  const utils = trpc.useUtils();

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: async () => {
      await utils.notification.unreadCount.invalidate();
      await utils.notification.list.invalidate();
    },
  });

  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: async () => {
      await utils.notification.unreadCount.invalidate();
      await utils.notification.list.invalidate();
    },
  });

  const items = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative text-neutral-400 hover:text-white transition-colors"
        aria-label="Notificacoes"
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -top-2 -right-2 min-w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-9 z-50 w-[360px] max-h-[420px] overflow-auto bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
            <p className="text-sm font-semibold text-neutral-200">Notificacoes</p>
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-40"
              disabled={markAllReadMutation.isPending}
            >
              Marcar todas como lidas
            </button>
          </div>

          {listQuery.isLoading ? (
            <div className="p-5 text-sm text-neutral-400 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Carregando notificacoes...
            </div>
          ) : items.length === 0 ? (
            <div className="p-5 text-sm text-neutral-500">Sem notificacoes recentes.</div>
          ) : (
            <ul className="divide-y divide-neutral-800">
              {items.map((item) => (
                <li key={item.id} className={`px-3 py-3 ${item.isRead ? 'bg-transparent' : 'bg-violet-500/5'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-neutral-200 font-medium">{item.title}</p>
                      <p className="text-xs text-neutral-400 mt-1">{item.message}</p>
                    </div>
                    {!item.isRead ? (
                      <button
                        type="button"
                        onClick={() => markReadMutation.mutate({ ids: [item.id] })}
                        className="text-neutral-400 hover:text-green-400"
                        title="Marcar como lida"
                      >
                        <CheckCheck size={14} />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
