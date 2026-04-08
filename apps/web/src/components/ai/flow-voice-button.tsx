import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useVoiceRecorder } from '../../hooks/use-voice-recorder';

type VoicePayload = {
  text: string;
  confidence?: number;
  durationMs?: number;
};

type FlowVoiceButtonProps = {
  disabled?: boolean;
  onTranscribed: (payload: VoicePayload) => void;
  onError?: (message: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
};

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Falha ao converter audio'));
        return;
      }
      const [, base64 = ''] = reader.result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Falha ao ler blob'));
    reader.readAsDataURL(blob);
  });
}

export function FlowVoiceButton({
  disabled,
  onTranscribed,
  onError,
  onBusyChange,
}: FlowVoiceButtonProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const ignoreClickRef = useRef(false);
  const recorder = useVoiceRecorder();
  const {
    isSupported,
    isRecording,
    isProcessing,
    audioBlob,
    durationMs,
    error,
    startRecording,
    stopRecording,
    clearAudio,
    clearError,
  } = recorder;
  const transcribeMutation = trpc.ai.transcribe.useMutation();

  const isBusy = Boolean(disabled) || isProcessing || transcribeMutation.isPending;

  useEffect(() => {
    if (onBusyChange) {
      onBusyChange(isBusy);
    }
  }, [isBusy, onBusyChange]);

  useEffect(() => {
    if (!error) return;
    setLocalError(error);
    if (onError) onError(error);
  }, [error, onError]);

  useEffect(() => {
    if (!audioBlob) return;

    let cancelled = false;

    const transcribe = async () => {
      try {
        const audioBase64 = await blobToBase64(audioBlob);
        const result = await transcribeMutation.mutateAsync({
          audio: audioBase64,
          mimeType: audioBlob.type || 'audio/webm',
          durationMs: Math.max(1, durationMs),
        });

        if (cancelled) return;
        setLocalError(null);
        if (onError) onError(null);
        onTranscribed({
          text: result.text,
          ...(result.confidence !== undefined ? { confidence: result.confidence } : {}),
          ...(result.durationMs !== undefined ? { durationMs: result.durationMs } : {}),
        });
      } catch {
        if (cancelled) return;
        const message = 'Nao consegui entender o audio. Tente digitar.';
        setLocalError(message);
        if (onError) onError(message);
      } finally {
        if (!cancelled) {
          clearAudio();
        }
      }
    };

    void transcribe();
    return () => {
      cancelled = true;
    };
  }, [
    audioBlob,
    clearAudio,
    durationMs,
    onError,
    onTranscribed,
    transcribeMutation,
  ]);

  if (!isSupported) {
    return null;
  }

  const handleStart = () => {
    if (isBusy || isRecording) return;
    clearError();
    setLocalError(null);
    if (onError) onError(null);
    void startRecording();
  };

  const handleStop = () => {
    if (!isRecording) return;
    stopRecording();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        id="flow-voice-button"
        type="button"
        disabled={isBusy}
        onMouseDown={() => {
          ignoreClickRef.current = true;
          handleStart();
        }}
        onMouseUp={handleStop}
        onMouseLeave={handleStop}
        onTouchStart={() => {
          ignoreClickRef.current = true;
          handleStart();
        }}
        onTouchEnd={handleStop}
        onClick={() => {
          if (ignoreClickRef.current) {
            ignoreClickRef.current = false;
            return;
          }
          if (recorder.isRecording) {
            handleStop();
          } else {
            handleStart();
          }
        }}
        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
          isRecording
            ? 'border-sky-400 bg-sky-500/15 text-sky-200 animate-pulse'
            : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-sky-500'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="inline-flex items-center gap-1.5">
          {transcribeMutation.isPending || isProcessing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isRecording ? (
            <Square size={14} />
          ) : (
            <Mic size={14} />
          )}
          {isRecording ? formatDuration(durationMs) : 'Voz'}
        </span>
      </button>
      {localError ? <p className="text-xs text-amber-300">{localError}</p> : null}
    </div>
  );
}
