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
        className={`max-w-[85%] rounded-lg px-4 py-3 border ${
          isUser
            ? 'bg-primary border-primary text-white'
            : 'bg-muted border-border text-muted-foreground'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className={`text-[11px] mt-2 ${isUser ? 'text-primary' : 'text-muted-foreground'}`}>{time}</p>
      </div>
    </div>
  );
}
