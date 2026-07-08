import { useMemo, useState } from 'react';
import {
  Brain,
  Download,
  Edit3,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { cn } from '../../lib/utils';

const MEMORY_CATEGORIES = [
  { value: 'general', label: 'Geral' },
  { value: 'client_preference', label: 'Preferência' },
  { value: 'workflow_rule', label: 'Regra' },
  { value: 'entity_alias', label: 'Alias' },
] as const;

const MEMORY_SCOPES = [
  { value: 'user', label: 'Usuário' },
  { value: 'tenant', label: 'Laboratório' },
] as const;

type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]['value'];
type MemoryScope = (typeof MEMORY_SCOPES)[number]['value'];
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type DraftMemory = {
  scope: MemoryScope;
  category: MemoryCategory;
  keyText: string;
  valueText: string;
  ttlDays: number;
};

type EditMemory = DraftMemory & {
  memoryId: string;
};

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (['string', 'number', 'boolean'].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== 'object') return false;
  return Object.values(value).every(isJsonValue);
}

function isJsonRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.values(value).every(isJsonValue);
}

function parseValueText(valueText: string): Record<string, JsonValue> {
  const parsed: unknown = JSON.parse(valueText);
  if (!isJsonRecord(parsed)) {
    throw new Error('Use um JSON de objeto, por exemplo {"valor":"sexta-feira"}.');
  }
  return parsed;
}

function formatDate(value: string | null): string {
  if (!value) return 'Nunca';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function categoryLabel(category: string): string {
  return MEMORY_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

function scopeLabel(scope: string): string {
  return MEMORY_SCOPES.find((item) => item.value === scope)?.label ?? scope;
}

function downloadJson(filename: string, payload: object) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

const initialDraft: DraftMemory = {
  scope: 'user',
  category: 'general',
  keyText: '',
  valueText: '{\n  "value": ""\n}',
  ttlDays: 180,
};

export function FlowAiMemoryTab() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | MemoryCategory>('all');
  const [scope, setScope] = useState<'all' | MemoryScope>('all');
  const [draft, setDraft] = useState<DraftMemory>(initialDraft);
  const [editDraft, setEditDraft] = useState<EditMemory | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  const listInput = useMemo(() => ({
    page: 1,
    limit: 50,
    ...(search.trim().length > 0 ? { search: search.trim() } : {}),
    ...(category !== 'all' ? { category } : {}),
    ...(scope !== 'all' ? { scope } : {}),
  }), [category, scope, search]);

  const settingsQuery = trpc.ai.memory.settings.useQuery();
  const listQuery = trpc.ai.memory.list.useQuery(listInput);
  const exportQuery = trpc.ai.memory.exportJson.useQuery(undefined, { enabled: false });

  async function invalidateMemory() {
    await Promise.all([
      utils.ai.memory.settings.invalidate(),
      utils.ai.memory.list.invalidate(),
      utils.ai.memory.exportJson.invalidate(),
    ]);
  }

  const settingsMutation = trpc.ai.memory.updateSettings.useMutation({
    onSuccess: async () => {
      setFeedback({ kind: 'success', message: 'Configuração de memória atualizada.' });
      await invalidateMemory();
    },
    onError: (error) => setFeedback({ kind: 'error', message: error.message }),
  });

  const rememberMutation = trpc.ai.memory.remember.useMutation({
    onSuccess: async () => {
      setDraft(initialDraft);
      setFeedback({ kind: 'success', message: 'Memória criada.' });
      await invalidateMemory();
    },
    onError: (error) => setFeedback({ kind: 'error', message: error.message }),
  });

  const updateMutation = trpc.ai.memory.update.useMutation({
    onSuccess: async () => {
      setEditDraft(null);
      setFeedback({ kind: 'success', message: 'Memória atualizada.' });
      await invalidateMemory();
    },
    onError: (error) => setFeedback({ kind: 'error', message: error.message }),
  });

  const renewMutation = trpc.ai.memory.renew.useMutation({
    onSuccess: async () => {
      setFeedback({ kind: 'success', message: 'TTL renovado.' });
      await invalidateMemory();
    },
    onError: (error) => setFeedback({ kind: 'error', message: error.message }),
  });

  const forgetMutation = trpc.ai.memory.forget.useMutation({
    onSuccess: async () => {
      setFeedback({ kind: 'success', message: 'Memória removida.' });
      await invalidateMemory();
    },
    onError: (error) => setFeedback({ kind: 'error', message: error.message }),
  });

  const forgetAllMutation = trpc.ai.memory.forgetAll.useMutation({
    onSuccess: async (result) => {
      setPurgeConfirm('');
      setFeedback({ kind: 'success', message: `${result.deleted} memórias removidas.` });
      await invalidateMemory();
    },
    onError: (error) => setFeedback({ kind: 'error', message: error.message }),
  });

  const settings = settingsQuery.data;
  const memoryList = listQuery.data;
  const usagePercent = Math.min(100, Math.round(((memoryList?.total ?? 0) / (memoryList?.cap ?? 500)) * 100));
  const isBusy = settingsMutation.isPending
    || rememberMutation.isPending
    || updateMutation.isPending
    || renewMutation.isPending
    || forgetMutation.isPending
    || forgetAllMutation.isPending;

  async function createMemory() {
    setFeedback(null);
    try {
      const valueJson = parseValueText(draft.valueText);
      await rememberMutation.mutateAsync({
        scope: draft.scope,
        category: draft.category,
        keyText: draft.keyText,
        valueJson,
        ttlDays: draft.ttlDays,
      });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'JSON inválido.' });
    }
  }

  async function saveEdit() {
    if (!editDraft) return;
    setFeedback(null);
    try {
      const valueJson = parseValueText(editDraft.valueText);
      await updateMutation.mutateAsync({
        memoryId: editDraft.memoryId,
        keyText: editDraft.keyText,
        category: editDraft.category,
        valueJson,
        ttlDays: editDraft.ttlDays,
      });
    } catch (error) {
      setFeedback({ kind: 'error', message: error instanceof Error ? error.message : 'JSON inválido.' });
    }
  }

  async function exportMemories() {
    const result = await exportQuery.refetch();
    if (!result.data) return;
    downloadJson(`flow-ia-memoria-${new Date().toISOString().slice(0, 10)}.json`, result.data);
  }

  async function purgeMemories() {
    if (purgeConfirm !== 'CONFIRMAR') {
      setFeedback({ kind: 'error', message: 'Digite CONFIRMAR para apagar todas as memórias acessíveis.' });
      return;
    }
    await forgetAllMutation.mutateAsync({ confirmText: 'CONFIRMAR' });
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="rounded-lg border border-border/50 bg-card/30 p-8 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="animate-spin" size={16} />
        <span className="text-sm font-semibold">Carregando memória persistente...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-border/50 bg-card/30 p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <Brain size={20} className="text-primary" />
            <div>
              <h3 className="text-lg font-semibold uppercase tracking-normal text-foreground">Memória Persistente</h3>
              <p className="text-xs text-muted-foreground">
                Escopo por tenant, opt-in explícito e TTL obrigatório.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isBusy || !settings?.allowedByPlan}
              onClick={() => void settingsMutation.mutateAsync({ enabled: !settings?.enabled })}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {settings?.enabled ? <ShieldCheck size={14} /> : <PlayCircle size={14} />}
              {settings?.enabled ? 'Opt-in ativo' : 'Ativar opt-in'}
            </button>
            <button
              type="button"
              disabled={isBusy || !settings?.enabled}
              onClick={() => void settingsMutation.mutateAsync({ paused: !settings?.paused })}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {settings?.paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
              {settings?.paused ? 'Retomar recall' : 'Pausar recall'}
            </button>
            <button
              type="button"
              onClick={() => void exportMemories()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Download size={14} />
              Exportar JSON
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <span className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">Plano</span>
            <p className="mt-1 text-sm font-semibold text-foreground">{settings?.plan ?? 'indefinido'}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <span className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">Elegível</span>
            <p className={cn('mt-1 text-sm font-semibold', settings?.allowedByPlan ? 'text-success' : 'text-destructive')}>
              {settings?.allowedByPlan ? 'Sim' : 'Não'}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <span className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">Uso</span>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {memoryList?.total ?? 0}/{memoryList?.cap ?? 500}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <span className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">Recall</span>
            <p className={cn('mt-1 text-sm font-semibold', settings?.paused ? 'text-[var(--warning)]' : 'text-success')}>
              {settings?.paused ? 'Pausado' : 'Ativo'}
            </p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usagePercent}%` }} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-border/50 bg-card/30 overflow-hidden">
          <div className="border-b border-border/50 p-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por chave"
                className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as 'all' | MemoryCategory)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="all">Todas categorias</option>
              {MEMORY_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as 'all' | MemoryScope)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="all">Todos escopos</option>
              {MEMORY_SCOPES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>

          {listQuery.isLoading ? (
            <div className="p-8 flex items-center gap-3 text-muted-foreground">
              <Loader2 className="animate-spin" size={16} />
              <span className="text-sm font-semibold">Carregando memórias...</span>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {(memoryList?.items ?? []).map((memory) => (
                <div key={memory.id} className="p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-normal text-primary">
                          {categoryLabel(memory.category)}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                          {scopeLabel(memory.scope)}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">{memory.keyText}</h4>
                      <pre className="max-h-32 overflow-auto rounded-lg border border-border/60 bg-background/50 p-3 text-xs text-muted-foreground">
                        {JSON.stringify(memory.valueJson, null, 2)}
                      </pre>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => setEditDraft({
                          memoryId: memory.id,
                          scope: memory.scope,
                          category: memory.category,
                          keyText: memory.keyText,
                          valueText: JSON.stringify(memory.valueJson, null, 2),
                          ttlDays: 180,
                        })}
                        className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        title="Renovar TTL"
                        disabled={renewMutation.isPending}
                        onClick={() => void renewMutation.mutateAsync({ memoryId: memory.id, ttlDays: 180 })}
                        className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        type="button"
                        title="Excluir"
                        disabled={forgetMutation.isPending}
                        onClick={() => {
                          if (window.confirm('Excluir esta memória?')) {
                            void forgetMutation.mutateAsync({ memoryId: memory.id });
                          }
                        }}
                        className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-destructive hover:bg-destructive/20 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                    <span>Expira: {formatDate(memory.expiresAt)}</span>
                    <span>Acessos: {memory.accessCount}</span>
                    <span>Atualizada: {formatDate(memory.updatedAt)}</span>
                  </div>
                </div>
              ))}

              {memoryList?.items.length === 0 ? (
                <div className="p-8 text-sm text-muted-foreground">Nenhuma memória encontrada.</div>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border/50 bg-card/30 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Plus size={16} className="text-primary" />
              <h4 className="text-sm font-semibold uppercase tracking-normal text-foreground">Nova memória</h4>
            </div>
            <select
              value={draft.scope}
              onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value as MemoryScope }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {MEMORY_SCOPES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select
              value={draft.category}
              onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as MemoryCategory }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {MEMORY_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <input
              value={draft.keyText}
              onChange={(event) => setDraft((current) => ({ ...current, keyText: event.target.value }))}
              placeholder="Chave"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <textarea
              value={draft.valueText}
              onChange={(event) => setDraft((current) => ({ ...current, valueText: event.target.value }))}
              rows={6}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
            />
            <label className="space-y-1 block">
              <span className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">TTL dias</span>
              <input
                type="number"
                min={1}
                max={365}
                value={draft.ttlDays}
                onChange={(event) => setDraft((current) => ({ ...current, ttlDays: Number(event.target.value) }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <button
              type="button"
              disabled={rememberMutation.isPending || !settings?.enabled}
              onClick={() => void createMemory()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {rememberMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar memória
            </button>
          </div>

          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-5 space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-normal text-destructive">Apagar tudo</h4>
            <input
              value={purgeConfirm}
              onChange={(event) => setPurgeConfirm(event.target.value)}
              placeholder="CONFIRMAR"
              className="w-full rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm text-foreground"
            />
            <button
              type="button"
              disabled={forgetAllMutation.isPending}
              onClick={() => void purgeMemories()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {forgetAllMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Remover memórias
            </button>
          </div>
        </div>
      </div>

      {editDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-sm font-semibold uppercase tracking-normal text-foreground">Editar memória</h4>
              <button
                type="button"
                onClick={() => setEditDraft(null)}
                className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
            <input
              value={editDraft.keyText}
              onChange={(event) => setEditDraft((current) => current ? ({ ...current, keyText: event.target.value }) : current)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            <select
              value={editDraft.category}
              onChange={(event) => setEditDraft((current) => current ? ({
                ...current,
                category: event.target.value as MemoryCategory,
              }) : current)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {MEMORY_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <textarea
              value={editDraft.valueText}
              onChange={(event) => setEditDraft((current) => current ? ({ ...current, valueText: event.target.value }) : current)}
              rows={8}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground"
            />
            <label className="space-y-1 block">
              <span className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">TTL dias</span>
              <input
                type="number"
                min={1}
                max={365}
                value={editDraft.ttlDays}
                onChange={(event) => setEditDraft((current) => current ? ({
                  ...current,
                  ttlDays: Number(event.target.value),
                }) : current)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditDraft(null)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={updateMutation.isPending}
                onClick={() => void saveEdit()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div
          className={cn(
            'fixed bottom-10 right-10 z-[60] flex items-center gap-3 rounded-lg border px-5 py-3 text-xs font-semibold shadow-md',
            feedback.kind === 'success'
              ? 'border-success/20 bg-success/10 text-success'
              : 'border-destructive/20 bg-destructive/10 text-destructive',
          )}
        >
          {feedback.kind === 'success' ? <ShieldCheck size={14} /> : <X size={14} />}
          {feedback.message}
        </div>
      ) : null}
    </div>
  );
}
