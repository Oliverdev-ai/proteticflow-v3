import type { AiMessage } from '@proteticflow/shared';

type MessageBubbleProps = {
  message: AiMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const time = new Date(message.createdAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 border ${
          isUser
            ? 'bg-primary border-primary text-white'
            : 'bg-zinc-900 border-zinc-800 text-zinc-100'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className={`text-[11px] mt-2 ${isUser ? 'text-primary' : 'text-zinc-500'}`}>{time}</p>
      </div>
    </div>
  );
}
