import { useState } from 'react';

type ChatInputProps = {
  disabled?: boolean;
  isSending: boolean;
  onSend: (content: string) => Promise<void>;
};

export function ChatInput({ disabled, isSending, onSend }: ChatInputProps) {
  const [content, setContent] = useState('');

  async function handleSubmit() {
    const value = content.trim();
    if (!value || disabled || isSending) {
      return;
    }
    setContent('');
    await onSend(value);
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 space-y-3">
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
        placeholder="Digite sua mensagem para o Flow IA..."
        className="w-full min-h-[110px] rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
        disabled={disabled || isSending}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={disabled || isSending || content.trim().length === 0}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
        >
          {isSending ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}
