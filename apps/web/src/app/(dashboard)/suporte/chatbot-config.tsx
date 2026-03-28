import { trpc } from '../../../lib/trpc';
import { TemplateEditor } from '../../../components/support/template-editor';

export default function ChatbotConfigPage() {
  const utils = trpc.useUtils();
  const templatesQuery = trpc.support.listTemplates.useQuery();
  const upsertTemplateMutation = trpc.support.upsertTemplate.useMutation();
  const deleteTemplateMutation = trpc.support.deleteTemplate.useMutation();

  const busy = upsertTemplateMutation.isPending || deleteTemplateMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Suporte • Configuração do Chatbot</h1>
        <p className="text-sm text-neutral-400">Gerencie templates de respostas automáticas por intenção.</p>
      </div>

      <TemplateEditor
        templates={templatesQuery.data ?? []}
        busy={busy}
        onSave={async (payload) => {
          await upsertTemplateMutation.mutateAsync(payload);
          await utils.support.listTemplates.invalidate();
        }}
        onDelete={async (templateId) => {
          await deleteTemplateMutation.mutateAsync({ templateId });
          await utils.support.listTemplates.invalidate();
        }}
      />
    </div>
  );
}
