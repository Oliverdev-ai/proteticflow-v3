import { useState } from 'react';
import type { AutoResponseTemplate } from '@proteticflow/shared';

type TemplateEditorProps = {
  templates: AutoResponseTemplate[];
  busy?: boolean;
  onSave: (payload: { id?: number; intent: string; title: string; body: string; isActive: boolean }) => Promise<void>;
  onDelete: (templateId: number) => Promise<void>;
};

export function TemplateEditor({ templates, busy, onSave, onDelete }: TemplateEditorProps) {
  const [intent, setIntent] = useState('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isActive, setIsActive] = useState(true);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Novo template</h2>
        <input value={intent} onChange={(event) => setIntent(event.target.value)} placeholder="Intent (ex: status_query)" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100" />
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título interno" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100" />
        <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Resposta automática" className="w-full min-h-[90px] rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100" />
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Template ativo
        </label>
        <button
          type="button"
          disabled={busy || intent.trim().length === 0 || title.trim().length === 0 || body.trim().length === 0}
          onClick={async () => {
            await onSave({ intent: intent.trim(), title: title.trim(), body: body.trim(), isActive });
            setTitle('');
            setBody('');
          }}
          className="px-4 py-2 rounded bg-primary hover:bg-primary text-white text-sm disabled:opacity-50"
        >
          Salvar template
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white">Templates cadastrados</h3>
        {templates.length === 0 ? <p className="text-xs text-zinc-500">Nenhum template cadastrado.</p> : null}
        {templates.map((template) => (
          <div key={template.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-sm text-white">{template.title}</p>
            <p className="text-xs text-zinc-400 mt-1">intent: {template.intent} • {template.isActive ? 'ativo' : 'inativo'}</p>
            <p className="text-sm text-zinc-300 mt-2 whitespace-pre-wrap">{template.body}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSave({ id: template.id, intent: template.intent, title: template.title, body: template.body, isActive: !template.isActive })}
                className="px-3 py-1.5 rounded text-xs bg-zinc-700 text-white disabled:opacity-50"
              >
                {template.isActive ? 'Desativar' : 'Ativar'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDelete(template.id)}
                className="px-3 py-1.5 rounded text-xs bg-red-700 text-white disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
