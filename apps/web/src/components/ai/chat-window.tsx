import { useEffect, useRef } from 'react';
import type { AiMessage } from '@proteticflow/shared';
import { MessageBubble } from './message-bubble';

type ChatWindowProps = {
  messages: AiMessage[];
  isLoading: boolean;
};

export function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 h-[58vh] overflow-y-auto space-y-3">
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-sm text-zinc-500">Inicie a conversa para criar esta sessao.</p>
        </div>
      ) : null}

      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isLoading ? (
        <div className="flex justify-start">
          <div className="rounded-2xl px-4 py-3 border bg-zinc-900 border-zinc-800 text-zinc-300">
            <p className="text-sm">Flow IA esta escrevendo...</p>
          </div>
        </div>
      ) : null}

      <div ref={endRef} />
    </div>
  );
}
