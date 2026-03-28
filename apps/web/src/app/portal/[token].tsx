import { useMemo, useState } from 'react';
import type { ChatbotMessage } from '@proteticflow/shared';
import { useParams } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { PortalHeader } from '../../components/portal/portal-header';
import { PortalTimeline } from '../../components/portal/portal-timeline';
import { PortalPhotos } from '../../components/portal/portal-photos';
import { PortalEmpty } from '../../components/portal/portal-empty';
import { PortalError } from '../../components/portal/portal-error';
import { SatisfactionRating } from '../../components/support/satisfaction-rating';

export default function PublicPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [chatText, setChatText] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatbotMessage[]>([]);
  const [escalated, setEscalated] = useState(false);

  const query = trpc.portal.getPortalByToken.useQuery(
    { token: token ?? '' },
    { enabled: Boolean(token) },
  );
  const startConversationMutation = trpc.support.startConversation.useMutation();
  const sendChatMessageMutation = trpc.support.sendChatMessage.useMutation();
  const rateConversationMutation = trpc.support.rateConversation.useMutation();

  const snapshot = query.data;
  const hasJobs = useMemo(() => (snapshot?.jobs.length ?? 0) > 0, [snapshot?.jobs.length]);

  return (
    <div className="min-h-screen bg-neutral-100 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {query.isLoading ? (
          <section className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-600">
            Carregando portal...
          </section>
        ) : null}

        {query.isError ? (
          <PortalError message={query.error.message} />
        ) : null}

        {snapshot ? (
          <>
            <PortalHeader
              tenantName={snapshot.tenantName}
              tenantLogoUrl={snapshot.tenantLogoUrl}
              tenantPrimaryColor={snapshot.tenantPrimaryColor}
              clientName={snapshot.clientName}
            />

            {hasJobs ? (
              <>
                <PortalTimeline jobs={snapshot.jobs} timelineByJob={snapshot.timelineByJob} />
                <PortalPhotos jobs={snapshot.jobs} photosByJob={snapshot.photosByJob} />
              </>
            ) : (
              <PortalEmpty />
            )}

            <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">💬 Falar com suporte</h2>
                <p className="text-sm text-neutral-600">
                  Tire dúvidas sobre status, prazos, orçamento e atendimento.
                </p>
              </div>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 max-h-72 overflow-y-auto space-y-2">
                {chatMessages.length === 0 ? (
                  <p className="text-sm text-neutral-500">Nenhuma mensagem ainda.</p>
                ) : null}

                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white ml-auto max-w-[85%]'
                        : 'bg-white border border-neutral-200 text-neutral-900 max-w-[85%]'
                    }`}
                  >
                    {message.content}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  value={chatText}
                  onChange={(event) => setChatText(event.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={chatText.trim().length === 0 || sendChatMessageMutation.isPending}
                  onClick={async () => {
                    if (!token || chatText.trim().length === 0) return;
                    let currentConversationId = conversationId;
                    if (!currentConversationId) {
                      const conversation = await startConversationMutation.mutateAsync({
                        portalToken: token,
                        type: 'general',
                      });
                      currentConversationId = conversation.id;
                      setConversationId(conversation.id);
                    }

                    const content = chatText.trim();
                    setChatText('');
                    const result = await sendChatMessageMutation.mutateAsync({
                      conversationId: currentConversationId,
                      content,
                    });
                    setChatMessages((prev) => [...prev, result.userMsg, result.assistantMsg]);
                    if (result.shouldEscalate) {
                      setEscalated(true);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-50"
                >
                  Enviar
                </button>
              </div>

              {conversationId ? (
                <SatisfactionRating
                  disabled={rateConversationMutation.isPending}
                  onRate={async (score) => {
                    const result = await rateConversationMutation.mutateAsync({
                      conversationId,
                      score,
                    });
                    if (result.shouldEscalate) {
                      setEscalated(true);
                    }
                  }}
                />
              ) : null}

              {escalated ? (
                <p className="text-sm text-amber-700">
                  Nossa equipe entrará em contato em breve.
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
