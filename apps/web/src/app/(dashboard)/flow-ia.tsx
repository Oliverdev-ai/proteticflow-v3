import { useEffect, useMemo, useState } from 'react';
import type { AiSession } from '@proteticflow/shared';
import { trpc } from '../../lib/trpc';
import { usePermissions } from '../../hooks/use-permissions';
import { SessionList } from '../../components/ai/session-list';
import { ChatWindow } from '../../components/ai/chat-window';
import { ChatInput } from '../../components/ai/chat-input';
import { QuickActions } from '../../components/ai/quick-actions';
import { ProactiveBanner } from '../../components/ai/proactive-banner';

export default function FlowIAPage() {
  const { role } = usePermissions();
  const utils = trpc.useUtils();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const sessionsQuery = trpc.ai.listSessions.useQuery({ limit: 20 });
  const labContextQuery = trpc.ai.getLabContext.useQuery();
  const sessionQuery = trpc.ai.getSession.useQuery(
    { sessionId: selectedSessionId ?? 0 },
    { enabled: Boolean(selectedSessionId) },
  );

  const createSessionMutation = trpc.ai.createSession.useMutation();
  const archiveSessionMutation = trpc.ai.archiveSession.useMutation();
  const sendMessageMutation = trpc.ai.sendMessage.useMutation();

  const activeSessions = useMemo(
    () => (sessionsQuery.data?.data ?? []).filter((session) => session.status === 'active'),
    [sessionsQuery.data?.data],
  );

  useEffect(() => {
    if (selectedSessionId) return;
    const firstSession = activeSessions[0];
    if (firstSession) {
      setSelectedSessionId(firstSession.id);
    }
  }, [activeSessions, selectedSessionId]);

  async function refreshSessionState(sessionId: number) {
    await Promise.all([
      utils.ai.getSession.invalidate({ sessionId }),
      utils.ai.listSessions.invalidate(),
    ]);
  }

  async function handleCreateSession() {
    const created = await createSessionMutation.mutateAsync({});
    setSelectedSessionId(created.id);
    await utils.ai.listSessions.invalidate();
  }

  async function handleArchiveSession(sessionId: number) {
    await archiveSessionMutation.mutateAsync({ sessionId });
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(null);
    }
    await Promise.all([
      utils.ai.listSessions.invalidate(),
      utils.ai.getSession.invalidate({ sessionId }),
    ]);
  }

  async function handleSend(content: string) {
    let sessionId = selectedSessionId;
    if (!sessionId) {
      const created = await createSessionMutation.mutateAsync({});
      sessionId = created.id;
      setSelectedSessionId(created.id);
    }

    await sendMessageMutation.mutateAsync({ sessionId, content });
    await refreshSessionState(sessionId);
  }

  async function handleQuickAction(prompt: string) {
    await handleSend(prompt);
  }

  const sessions: AiSession[] = sessionsQuery.data?.data ?? [];
  const messages = sessionQuery.data?.messages ?? [];
  const busy = createSessionMutation.isPending || archiveSessionMutation.isPending || sendMessageMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Flow IA</h1>
        <p className="text-sm text-neutral-400">
          Assistente contextual do laboratório com histórico de sessões e comandos por linguagem natural.
        </p>
      </div>

      <ProactiveBanner context={labContextQuery.data} onAction={handleQuickAction} />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-1">
          <SessionList
            sessions={sessions}
            selectedSessionId={selectedSessionId}
            isBusy={busy}
            onSelect={setSelectedSessionId}
            onCreate={handleCreateSession}
            onArchive={handleArchiveSession}
          />
        </div>

        <div className="xl:col-span-3 space-y-4">
          <QuickActions userRole={role} disabled={busy} onAction={handleQuickAction} />
          <ChatWindow messages={messages} isLoading={sendMessageMutation.isPending} />
          <ChatInput disabled={busy} isSending={sendMessageMutation.isPending} onSend={handleSend} />
        </div>
      </div>
    </div>
  );
}
