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
            ? 'bg-violet-600 border-violet-500 text-white'
            : 'bg-neutral-900 border-neutral-800 text-neutral-100'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className={`text-[11px] mt-2 ${isUser ? 'text-violet-100' : 'text-neutral-500'}`}>{time}</p>
      </div>
    </div>
  );
}
