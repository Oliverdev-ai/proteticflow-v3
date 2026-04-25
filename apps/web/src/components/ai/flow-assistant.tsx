import { useMemo, useRef, useState } from 'react';
import type { Role } from '@proteticflow/shared';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../hooks/use-auth';
import { AudioPlayer } from './audio-player';
import { ClarificationChips } from './clarification-chips';
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

type DisambiguationStep = {
  type: 'disambiguate';
  field: string;
  options: Array<{ id: number; label: string; detail?: string }>;
};

type FillMissingStep = {
  type: 'fill_missing';
  fields: Array<{ name: string; label: string; type: string; required: boolean }>;
};

type ReviewStep = {
  type: 'review';
  preview: {
    title: string;
    summary: string;
    details: Array<{ label: string; value: string }>;
  };
};

type ConfirmStep = {
  type: 'confirm';
  warning: string;
  action: string;
  preview?: {
    title: string;
    summary: string;
    details: Array<{ label: string; value: string }>;
  };
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
  confirmationStep?: DisambiguationStep | FillMissingStep | ReviewStep | ConfirmStep;
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

const VOICE_CLARIFICATION_TIMEOUT_MS = 15_000;

function formatRunDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mapOrdinalIndex(text: string): number | null {
  const normalized = normalizeText(text);
  if (normalized.includes('primeiro') || /\b1\b/.test(normalized)) return 0;
  if (normalized.includes('segundo') || /\b2\b/.test(normalized)) return 1;
  if (normalized.includes('terceiro') || /\b3\b/.test(normalized)) return 2;
  if (normalized.includes('quarto') || /\b4\b/.test(normalized)) return 3;
  return null;
}

function resolveClarificationOption(step: DisambiguationStep, transcript: string): { id: number } | null {
  const normalizedTranscript = normalizeText(transcript);
  if (normalizedTranscript.length === 0) return null;

  const ordinalIndex = mapOrdinalIndex(normalizedTranscript);
  if (ordinalIndex !== null && step.options[ordinalIndex]) {
    return { id: step.options[ordinalIndex]!.id };
  }

  const byLabel = step.options.find((option) => {
    const normalizedLabel = normalizeText(option.label);
    return normalizedLabel.includes(normalizedTranscript) || normalizedTranscript.includes(normalizedLabel);
  });

  if (byLabel) {
    return { id: byLabel.id };
  }

  const tokens = normalizedTranscript
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  for (const token of tokens) {
    const match = step.options.find((option) => normalizeText(option.label).includes(token));
    if (match) {
      return { id: match.id };
    }
  }

  return null;
}

export function FlowAssistant({
  role,
  sessionId,
  disabled,
  onEnsureSession,
  onCommandResolved,
}: FlowAssistantProps) {
  const { user } = useAuth();
  const [lastResponse, setLastResponse] = useState<CommandResponse | null>(null);
  const [commandInput, setCommandInput] = useState('');
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [transcriptConfidence, setTranscriptConfidence] = useState<number | undefined>(undefined);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioChunks, setAudioChunks] = useState<Array<{ audioBase64: string; text: string }>>([]);
  const [clarificationVoiceDeadline, setClarificationVoiceDeadline] = useState<number | null>(null);
  const lastSpokenKeyRef = useRef<string | null>(null);

  const executeCommandMutation = trpc.ai.executeCommand.useMutation();
  const resolveCommandStepMutation = trpc.ai.resolveCommandStep.useMutation();
  const confirmCommandMutation = trpc.ai.confirmCommand.useMutation();
  const cancelCommandMutation = trpc.ai.cancelCommand.useMutation();
  const ttsMutation = trpc.ai.tts.useMutation();
  const listRunsQuery = trpc.ai.listCommandRuns.useQuery(
    { sessionId: sessionId ?? undefined, limit: 8 },
    { enabled: Boolean(sessionId) },
  );

  const voiceEnabled = user?.aiVoiceEnabled ?? true;
  const voiceGender = user?.aiVoiceGender === 'male' ? 'male' : 'female';
  const voiceSpeed = typeof user?.aiVoiceSpeed === 'number' ? user.aiVoiceSpeed : 1;

  const isBusy = disabled
    || voiceBusy
    || executeCommandMutation.isPending
    || resolveCommandStepMutation.isPending
    || confirmCommandMutation.isPending
    || cancelCommandMutation.isPending;

  const disambiguationStep = lastResponse?.confirmationStep?.type === 'disambiguate'
    ? lastResponse.confirmationStep
    : null;

  const isClarificationVoiceWindowOpen = clarificationVoiceDeadline !== null
    && clarificationVoiceDeadline > Date.now();

  async function refresh() {
    await listRunsQuery.refetch();
    if (onCommandResolved) {
      await onCommandResolved();
    }
  }

  function beginClarificationWindow(response: CommandResponse) {
    if (response.status === 'ambiguous' && response.confirmationStep?.type === 'disambiguate') {
      setClarificationVoiceDeadline(Date.now() + VOICE_CLARIFICATION_TIMEOUT_MS);
      return;
    }
    setClarificationVoiceDeadline(null);
  }

  async function enqueueTtsFromResponse(response: CommandResponse) {
    if (!voiceEnabled) return;
    if (response.message.trim().length === 0) return;

    const spokenKey = `${response.run.id}:${response.status}:${response.message}`;
    if (lastSpokenKeyRef.current === spokenKey) return;
    lastSpokenKeyRef.current = spokenKey;

    try {
      const synthesized = await ttsMutation.mutateAsync({
        text: response.message,
        voice: voiceGender,
        speakingRate: voiceSpeed,
        ssml: false,
      });

      setAudioChunks((current) => [...current, {
        audioBase64: synthesized.audioBase64,
        text: response.message,
      }].slice(-24));
      setVoiceError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao gerar audio da resposta.';
      setVoiceError(message);
    }
  }

  async function applyResponse(response: CommandResponse) {
    setLastResponse(response);
    beginClarificationWindow(response);
    await refresh();
    await enqueueTtsFromResponse(response);
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

    await applyResponse(response as CommandResponse);
  }

  async function handleSendTranscript() {
    const text = transcriptText.trim();
    if (!text) return;

    if (lastResponse?.status === 'ambiguous' && disambiguationStep) {
      if (!isClarificationVoiceWindowOpen) {
        setVoiceError('Tempo da resposta por voz expirou. Selecione um chip para continuar.');
        return;
      }

      const resolved = resolveClarificationOption(disambiguationStep, text);
      if (resolved) {
        const response = await resolveCommandStepMutation.mutateAsync({
          commandRunId: lastResponse.run.id,
          values: { [disambiguationStep.field]: resolved.id },
        });
        await applyResponse(response as CommandResponse);
        setTranscriptText('');
        setTranscriptConfidence(undefined);
        return;
      }
    }

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
    await applyResponse(response as CommandResponse);
  }

  async function handleResolveStep(runId: number, values: Record<string, unknown>) {
    const response = await resolveCommandStepMutation.mutateAsync({
      commandRunId: runId,
      values,
    });
    await applyResponse(response as CommandResponse);
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
    setClarificationVoiceDeadline(null);
    await refresh();
  }

  const recentRuns = useMemo(() => listRunsQuery.data?.data ?? [], [listRunsQuery.data?.data]);

  return (
    <div className="space-y-3">
      <FlowQuickActions disabled={isBusy} onAction={runCommand} />

      {audioChunks.length > 0 ? (
        <AudioPlayer audioChunks={audioChunks} />
      ) : null}

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
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Pipeline F38</p>
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

      {lastResponse?.status === 'ambiguous' && disambiguationStep ? (
        <div className="space-y-2">
          <ClarificationChips
            candidates={disambiguationStep.options}
            disabled={isBusy}
            onSelect={(option) => {
              void handleResolveStep(lastResponse.run.id, {
                [disambiguationStep.field]: option.id,
              });
            }}
          />
          {isClarificationVoiceWindowOpen ? (
            <p className="text-[11px] text-zinc-400">
              Responda por voz em ate 15s (ex: "o segundo" ou "Silva"), ou clique em um chip.
            </p>
          ) : (
            <p className="text-[11px] text-zinc-500">
              Janela de resposta por voz encerrada. Continue pelos chips.
            </p>
          )}
        </div>
      ) : null}

      {lastResponse && ['awaiting_confirmation', 'missing_fields'].includes(lastResponse.status) ? (
        <FlowActionConfirmation
          runId={lastResponse.run.id}
          command={lastResponse.run.intent ?? 'comando'}
          {...(lastResponse.preview ? { preview: lastResponse.preview } : {})}
          {...(lastResponse.confirmationStep ? { step: lastResponse.confirmationStep } : {})}
          isSubmitting={isBusy}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onResolve={handleResolveStep}
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
