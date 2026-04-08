import { useState } from 'react';
import type { SupportTicket, TicketMessage } from '@proteticflow/shared';

type TicketDetailProps = {
  ticket: SupportTicket | null;
  messages: TicketMessage[];
  busy?: boolean;
  onUpdate: (payload: { status?: SupportTicket['status']; priority?: SupportTicket['priority'] }) => Promise<void>;
  onAddMessage: (payload: { content: string; isInternal: boolean }) => Promise<void>;
};

export function TicketDetail({ ticket, messages, busy, onUpdate, onAddMessage }: TicketDetailProps) {
  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  if (!ticket) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm text-zinc-500">Selecione um ticket para ver detalhes.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg text-white font-semibold">{ticket.subject}</h3>
        <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300">#{ticket.id}</span>
      </div>

      <p className="text-sm text-zinc-300">{ticket.description}</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void onUpdate({ status: 'in_progress' })} className="px-3 py-1.5 rounded text-xs bg-blue-700 text-white disabled:opacity-50">Em andamento</button>
        <button type="button" disabled={busy} onClick={() => void onUpdate({ status: 'resolved' })} className="px-3 py-1.5 rounded text-xs bg-emerald-700 text-white disabled:opacity-50">Resolver</button>
        <button type="button" disabled={busy} onClick={() => void onUpdate({ status: 'closed' })} className="px-3 py-1.5 rounded text-xs bg-zinc-700 text-white disabled:opacity-50">Fechar</button>
      </div>

      <div className="space-y-2 max-h-[34vh] overflow-y-auto border border-zinc-800 rounded-xl p-3 bg-zinc-950">
        {messages.length === 0 ? <p className="text-xs text-zinc-500">Sem mensagens.</p> : null}
        {messages.map((message) => (
          <div key={message.id} className="border border-zinc-800 rounded-lg px-3 py-2">
            <p className="text-sm text-zinc-200 whitespace-pre-wrap">{message.content}</p>
            <p className="text-[11px] text-zinc-500 mt-1">
              {message.isInternal ? 'Interna' : 'Cliente'} • {new Date(message.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Responder ticket..."
          className="w-full min-h-[90px] rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm px-3 py-2"
        />
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} />
          Mensagem interna (somente staff)
        </label>
        <button
          type="button"
          disabled={busy || content.trim().length === 0}
          onClick={async () => {
            await onAddMessage({ content: content.trim(), isInternal });
            setContent('');
            setIsInternal(false);
          }}
          className="px-4 py-2 rounded bg-primary hover:bg-primary text-white text-sm disabled:opacity-50"
        >
          Enviar mensagem
        </button>
      </div>
    </div>
  );
}
