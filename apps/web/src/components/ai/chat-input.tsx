import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { SendHorizontal } from 'lucide-react';

type Props = { 
  onSend: (text: string) => Promise<void> | void; 
  disabled?: boolean;
  isSending?: boolean; 
};

export function ChatInput({ onSend, disabled, isSending }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, bulletList: false, orderedList: false }),
      Placeholder.configure({ placeholder: 'Peça algo ao Flow... Ex: "Abre trabalho pro Dr. Marcelo, cor A2, sexta"' }),
    ],
    editorProps: {
      attributes: { class: 'prose prose-sm prose-invert max-w-none focus:outline-none min-h-[40px] max-h-[120px] overflow-y-auto px-4 py-2.5 text-sm outline-none' },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          const text = view.state.doc.textContent.trim();
          if (text && !disabled && !isSending) { 
            void onSend(text); 
            view.dispatch(view.state.tr.delete(0, view.state.doc.content.size)); 
          }
          return true;
        }
        return false;
      },
    },
  });

  return (
    <div className="flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shadow-inner focus-within:ring-2 focus-within:ring-primary/50 transition-all">
      <div className="flex-1 py-1">
        <EditorContent editor={editor} />
      </div>
      <button 
        type="button"
        onClick={() => { 
          if (!editor || disabled || isSending) return; 
          const t = editor.getText().trim(); 
          if (t) { void onSend(t); editor.commands.clearContent(); } 
        }}
        disabled={disabled || isSending} 
        className="p-2.5 rounded-lg bg-primary text-white hover:bg-primary disabled:opacity-50 transition-colors shrink-0 mb-0.5"
      >
        <SendHorizontal size={16} />
      </button>
    </div>
  );
}

