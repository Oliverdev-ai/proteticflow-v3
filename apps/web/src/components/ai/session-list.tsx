import type { AiSession } from '@proteticflow/shared';

type SessionListProps = {
  sessions: AiSession[];
  selectedSessionId: number | null;
  isBusy: boolean;
  onSelect: (sessionId: number) => void;
  onCreate: () => Promise<void>;
  onArchive: (sessionId: number) => Promise<void>;
};

export function SessionList({
  sessions,
  selectedSessionId,
  isBusy,
  onSelect,
  onCreate,
  onArchive,
}: SessionListProps) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Sessões</h2>
        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={isBusy}
          className="text-xs px-2.5 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white"
        >
          Nova
        </button>
      </div>

      <div className="space-y-2 max-h-[58vh] overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="text-xs text-neutral-500">Nenhuma sessão criada.</p>
        ) : null}

        {sessions.map((session) => {
          const isSelected = selectedSessionId === session.id;
          return (
            <div
              key={session.id}
              className={`rounded-xl border px-3 py-2 ${
                isSelected ? 'border-violet-500 bg-violet-500/10' : 'border-neutral-800 bg-neutral-950'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(session.id)}
                className="w-full text-left"
              >
                <p className="text-sm text-neutral-100 truncate">{session.title ?? `Sessão #${session.id}`}</p>
                <p className="text-[11px] text-neutral-500 mt-1">
                  {session.messageCount ?? 0} msgs • {new Date(session.updatedAt).toLocaleDateString('pt-BR')}
                </p>
              </button>

              {session.status === 'active' ? (
                <button
                  type="button"
                  onClick={() => void onArchive(session.id)}
                  disabled={isBusy}
                  className="mt-2 text-[11px] text-amber-300 hover:text-amber-200 disabled:opacity-50"
                >
                  Arquivar
                </button>
              ) : (
                <p className="mt-2 text-[11px] text-neutral-500">Arquivada</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
