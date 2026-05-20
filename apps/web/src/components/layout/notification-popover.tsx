import { useMemo, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';

type NotificationUiType = 'info' | 'warning' | 'error';

const TYPE_UI: Record<NotificationUiType, { label: string; className: string }> = {
  info: {
    label: 'Info',
    className: 'bg-[var(--primary)]/15 text-[var(--primary)] border-[var(--primary)]/30',
  },
  warning: { label: 'Aviso', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  error: { label: 'Erro', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

export function NotificationPopover({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

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
        className="relative text-muted-foreground hover:text-foreground transition-colors"
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
        <div className="absolute right-0 top-9 z-50 w-[360px] max-h-[420px] overflow-auto bg-card border border-border rounded-xl shadow-xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Notificacoes</p>
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              className="text-xs text-[var(--primary)] hover:text-[var(--primary-hover)] disabled:opacity-40"
              disabled={markAllReadMutation.isPending}
            >
              Marcar todas como lidas
            </button>
          </div>

          {listQuery.isLoading ? (
            <div className="p-5 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Carregando notificacoes...
            </div>
          ) : items.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">Sem notificacoes recentes.</div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`px-3 py-3 ${item.isRead ? 'bg-transparent' : 'bg-primary/5'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {(() => {
                        const type = (item.type ?? 'info') as NotificationUiType;
                        const ui = TYPE_UI[type] ?? TYPE_UI.info;
                        return (
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ui.className}`}
                          >
                            {ui.label}
                          </span>
                        );
                      })()}
                      <p className="text-sm text-foreground font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.message}</p>
                    </div>
                    {!item.isRead ? (
                      <button
                        type="button"
                        onClick={() => markReadMutation.mutate({ ids: [item.id] })}
                        className="text-muted-foreground hover:text-[var(--primary)]"
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
