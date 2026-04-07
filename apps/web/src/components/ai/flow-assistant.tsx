import { useMemo, useState } from 'react';
import type { Role } from '@proteticflow/shared';
import { trpc } from '../../lib/trpc';
import { FlowActionConfirmation } from './flow-action-confirmation';
import { FlowQuickActions } from './flow-quick-actions';
import { FlowTranscriptPreview } from './flow-transcript-preview';
import { FlowVoiceButton } from './flow-voice-button';

type CommandRunView = {
  id: number;
  intent: string | null;
  executionStatus: string;
  createdAt: string;
};

type CommandResponse = {
  status: 'executed' | 'awaiting_confirmation' | 'ambiguous' | 'missing_fields' | 'blocked' | 'no_intent' | 'error';
  message: string;
  run: CommandRunView;
  preview?: {
    title: string;
    summary: string;
    details: Array<{ label: string; value: string }>;
  };
  missingFields?: string[];
  suggestedIntents?: string[];
};

type FlowAssistantProps = {
  role: Role;
  sessionId: number | null;
  disabled?: boolean;
  onEnsureSession: () => Promise<number>;
  onCommandResolved?: () => Promise<void> | void;
};

function formatRunDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function FlowAssistant({
  role,
  sessionId,
  disabled,
  onEnsureSession,
  onCommandResolved,
}: FlowAssistantProps) {
  const [lastResponse, setLastResponse] = useState<CommandResponse | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptConfidence, setTranscriptConfidence] = useState<number | undefined>(undefined);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const executeCommandMutation = trpc.ai.executeCommand.useMutation();
  const confirmCommandMutation = trpc.ai.confirmCommand.useMutation();
  const cancelCommandMutation = trpc.ai.cancelCommand.useMutation();
  const listRunsQuery = trpc.ai.listCommandRuns.useQuery(
    { sessionId: sessionId ?? undefined, limit: 8 },
    { enabled: Boolean(sessionId) },
  );

  const isBusy = disabled
    || voiceBusy
    || executeCommandMutation.isPending
    || confirmCommandMutation.isPending
    || cancelCommandMutation.isPending;

  async function refresh() {
    await listRunsQuery.refetch();
    if (onCommandResolved) {
      await onCommandResolved();
    }
  }

  async function runCommand(content: string, channel: 'text' | 'voice' = 'text') {
    const payload = content.trim();
    if (!payload) return;

    const targetSessionId = sessionId ?? await onEnsureSession();
    const response = await executeCommandMutation.mutateAsync({
      sessionId: targetSessionId,
      content: payload,
      channel,
    });

    setLastResponse(response as CommandResponse);
    await refresh();
  }

  async function handleSendTranscript() {
    const text = transcriptText.trim();
    if (!text) return;
    await runCommand(text, 'voice');
    setTranscriptText('');
    setTranscriptConfidence(undefined);
    setVoiceError(null);
  }

  function handleDiscardTranscript() {
    setTranscriptText('');
    setTranscriptConfidence(undefined);
    setVoiceError(null);
  }

  async function handleConfirm(runId: number) {
    const response = await confirmCommandMutation.mutateAsync({ commandRunId: runId });
    setLastResponse(response as CommandResponse);
    await refresh();
  }

  async function handleCancel(runId: number) {
    await cancelCommandMutation.mutateAsync({ commandRunId: runId });
    setLastResponse({
      status: 'error',
      message: 'Comando cancelado.',
      run: {
        id: runId,
        intent: null,
        executionStatus: 'cancelled',
        createdAt: new Date().toISOString(),
      },
    });
    await refresh();
  }

  const recentRuns = useMemo(() => listRunsQuery.data?.data ?? [], [listRunsQuery.data?.data]);

  return (
    <div className="space-y-3">
      <FlowQuickActions disabled={isBusy} onAction={runCommand} />

      {transcriptText ? (
        <FlowTranscriptPreview
          text={transcriptText}
          {...(transcriptConfidence !== undefined ? { confidence: transcriptConfidence } : {})}
          disabled={isBusy}
          onChange={setTranscriptText}
          onSend={handleSendTranscript}
          onDiscard={handleDiscardTranscript}
        />
      ) : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
        <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Comando estruturado</p>
        <div className="flex gap-2">
          <input
            id="flow-command-input"
            value={commandInput}
            onChange={(event) => setCommandInput(event.target.value)}
            placeholder="Ex: suspender os 123 por aguardando material"
            disabled={isBusy}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-sky-500 focus:outline-none"
          />
          <button
            id="flow-command-send"
            type="button"
            onClick={() => {
              void runCommand(commandInput);
              setCommandInput('');
            }}
            disabled={isBusy || commandInput.trim().length === 0}
            className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-sky-950 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Executar
          </button>
          <FlowVoiceButton
            disabled={isBusy}
            onBusyChange={setVoiceBusy}
            onError={setVoiceError}
            onTranscribed={({ text, confidence }) => {
              setTranscriptText(text);
              setTranscriptConfidence(confidence);
              setVoiceError(null);
            }}
          />
        </div>
        {voiceError ? (
          <p className="mt-2 text-xs text-amber-300">{voiceError}</p>
        ) : null}
      </div>

      {lastResponse ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Pipeline O1</p>
          <p className="text-sm text-zinc-100 whitespace-pre-wrap">{lastResponse.message}</p>

          {lastResponse.status === 'missing_fields' && lastResponse.missingFields?.length ? (
            <p className="text-xs text-amber-300 mt-2">
              Campos faltantes: {lastResponse.missingFields.join(', ')}
            </p>
          ) : null}

          {lastResponse.status === 'no_intent' && lastResponse.suggestedIntents?.length ? (
            <p className="text-xs text-zinc-400 mt-2">
              Sugestoes: {lastResponse.suggestedIntents.join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {lastResponse?.status === 'awaiting_confirmation' ? (
        <FlowActionConfirmation
          runId={lastResponse.run.id}
          command={lastResponse.run.intent ?? 'comando'}
          {...(lastResponse.preview ? { preview: lastResponse.preview } : {})}
          isSubmitting={isBusy}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      ) : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Ultimas execucoes</p>
          <p className="text-[11px] text-zinc-600">Perfil: {role}</p>
        </div>
        <div className="mt-2 space-y-1">
          {recentRuns.length === 0 ? (
            <p className="text-xs text-zinc-500">Nenhuma execucao registrada nesta sessao.</p>
          ) : null}
          {recentRuns.map((run) => (
            <div key={run.id} className="flex items-center justify-between text-xs text-zinc-300">
              <span className="truncate pr-2">{run.intent ?? 'sem intent'}</span>
              <span className="text-zinc-500">
                {run.executionStatus} - {formatRunDate(run.createdAt)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
