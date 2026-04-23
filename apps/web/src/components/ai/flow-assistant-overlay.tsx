import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Mic, X } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../hooks/use-auth';
import { usePermissions } from '../../hooks/use-permissions';
import { FlowAssistant } from './flow-assistant';

type OverlayState = {
  open: boolean;
  width: number;
  height: number;
};

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 600;

function getStorageKey(userId: number | undefined): string {
  if (!userId) return 'flow-assistant-overlay:anonymous';
  return `flow-assistant-overlay:${userId}`;
}

function readPersistedState(userId: number | undefined): OverlayState {
  if (typeof window === 'undefined') {
    return { open: false, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return { open: false, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    const parsed = JSON.parse(raw) as Partial<OverlayState>;

    return {
      open: Boolean(parsed.open),
      width: typeof parsed.width === 'number' ? Math.max(320, Math.min(720, parsed.width)) : DEFAULT_WIDTH,
      height: typeof parsed.height === 'number' ? Math.max(420, Math.min(900, parsed.height)) : DEFAULT_HEIGHT,
    };
  } catch {
    return { open: false, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }
}

function persistState(userId: number | undefined, state: OverlayState) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
  } catch {
    // ignore localStorage failures in private mode
  }
}

export function FlowAssistantOverlay() {
  const { user, isAuthenticated } = useAuth();
  const { role } = usePermissions();
  const utils = trpc.useUtils();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [overlayState, setOverlayState] = useState<OverlayState>(() => readPersistedState(user?.id));
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  ));

  const sessionsQuery = trpc.ai.listSessions.useQuery(
    { limit: 20 },
    { enabled: isAuthenticated && overlayState.open },
  );
  const createSessionMutation = trpc.ai.createSession.useMutation();

  const activeSessions = useMemo(
    () => (sessionsQuery.data?.data ?? []).filter((session) => session.status === 'active'),
    [sessionsQuery.data?.data],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setSessionId(null);
      setOverlayState({ open: false, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
      return;
    }

    setOverlayState(readPersistedState(user?.id));
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    persistState(user?.id, overlayState);
  }, [isAuthenticated, overlayState, user?.id]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey || event.code !== 'Space') {
        return;
      }

      event.preventDefault();
      setOverlayState((current) => ({ ...current, open: !current.open }));
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const listener = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (!overlayState.open) return;
    if (sessionId) return;

    const first = activeSessions[0];
    if (first) {
      setSessionId(first.id);
    }
  }, [activeSessions, overlayState.open, sessionId]);

  if (!isAuthenticated) {
    return null;
  }

  async function ensureSession(): Promise<number> {
    if (sessionId) return sessionId;

    const first = activeSessions[0];
    if (first) {
      setSessionId(first.id);
      return first.id;
    }

    const created = await createSessionMutation.mutateAsync({});
    setSessionId(created.id);
    await utils.ai.listSessions.invalidate();
    return created.id;
  }

  async function handleCommandResolved() {
    await utils.ai.listSessions.invalidate();
    if (sessionId) {
      await utils.ai.getSession.invalidate({ sessionId });
    }
  }

  const panelSize = isMobile
    ? { width: '100%', height: '100%' }
    : { width: `${overlayState.width}px`, height: `${overlayState.height}px` };

  return (
    <>
      <button
        type="button"
        onClick={() => setOverlayState((current) => ({ ...current, open: !current.open }))}
        className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500 text-sky-950 shadow-xl shadow-sky-500/20 hover:bg-sky-400"
        aria-label={overlayState.open ? 'Fechar Flow Assistant' : 'Abrir Flow Assistant'}
      >
        {overlayState.open ? <X size={20} /> : <Mic size={20} />}
      </button>

      {overlayState.open ? (
        <div
          ref={panelRef}
          data-flow-assistant
          className="fixed inset-0 md:inset-auto md:bottom-24 md:right-6 z-50 border border-zinc-800 bg-zinc-950 md:rounded-2xl md:resize md:overflow-auto shadow-2xl"
          style={panelSize}
          onMouseUp={() => {
            const element = panelRef.current;
            if (!element) return;

            setOverlayState((current) => ({
              ...current,
              width: Math.max(320, Math.min(720, element.offsetWidth)),
              height: Math.max(420, Math.min(900, element.offsetHeight)),
            }));
          }}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-sky-400" />
              <div>
                <p className="text-sm font-semibold text-zinc-100">Flow Assistant</p>
                <p className="text-[11px] text-zinc-500">Atalho global: Ctrl+Shift+Space</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOverlayState((current) => ({ ...current, open: false }))}
              className="rounded-md border border-zinc-700 p-1 text-zinc-300 hover:border-zinc-500"
              aria-label="Fechar painel do Flow Assistant"
            >
              <X size={14} />
            </button>
          </div>

          <div className="h-[calc(100%-58px)] overflow-y-auto p-4">
            <FlowAssistant
              role={role}
              sessionId={sessionId}
              onEnsureSession={ensureSession}
              onCommandResolved={handleCommandResolved}
              disabled={createSessionMutation.isPending}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
