import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_DURATION_MS = 60_000;
const TIMER_STEP_MS = 200;

type VoiceRecorderState = {
  isSupported: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  audioBlob: Blob | null;
  durationMs: number;
  error: string | null;
};

type UseVoiceRecorderResult = VoiceRecorderState & {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearAudio: () => void;
  clearError: () => void;
};

function pickSupportedMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [state, setState] = useState<VoiceRecorderState>({
    isSupported: false,
    isRecording: false,
    isProcessing: false,
    audioBlob: null,
    durationMs: 0,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const isStoppingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupMedia = useCallback(() => {
    clearTimer();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    startedAtRef.current = null;
    chunksRef.current = [];
    isStoppingRef.current = false;
  }, [clearTimer]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording' || isStoppingRef.current) {
      return;
    }

    isStoppingRef.current = true;
    setState((current) => ({ ...current, isProcessing: true }));
    clearTimer();
    recorder.stop();
  }, [clearTimer]);

  const startRecording = useCallback(async () => {
    if (!state.isSupported || state.isRecording || state.isProcessing) return;

    setState((current) => ({
      ...current,
      error: null,
      audioBlob: null,
      durationMs: 0,
    }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      isStoppingRef.current = false;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setState((current) => ({
          ...current,
          error: 'Falha ao capturar audio. Tente novamente.',
        }));
      };

      recorder.onstop = () => {
        const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : state.durationMs;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });

        cleanupMedia();
        setState((current) => ({
          ...current,
          isRecording: false,
          isProcessing: false,
          durationMs: elapsed,
          audioBlob: blob.size > 0 ? blob : null,
          ...(blob.size > 0 ? {} : { error: 'Nao foi possivel capturar audio.' }),
        }));
      };

      recorder.start();
      startedAtRef.current = Date.now();

      timerRef.current = window.setInterval(() => {
        if (startedAtRef.current === null) return;
        const elapsed = Date.now() - startedAtRef.current;
        setState((current) => ({
          ...current,
          durationMs: elapsed,
        }));
        if (elapsed >= MAX_DURATION_MS) {
          stopRecording();
        }
      }, TIMER_STEP_MS);

      setState((current) => ({
        ...current,
        isRecording: true,
        isProcessing: false,
        durationMs: 0,
      }));
    } catch {
      cleanupMedia();
      setState((current) => ({
        ...current,
        isRecording: false,
        isProcessing: false,
        error: 'Microfone indisponivel ou permissao negada.',
      }));
    }
  }, [cleanupMedia, state.durationMs, state.isProcessing, state.isRecording, state.isSupported, stopRecording]);

  const clearAudio = useCallback(() => {
    setState((current) => ({ ...current, audioBlob: null }));
  }, []);

  const clearError = useCallback(() => {
    setState((current) => ({ ...current, error: null }));
  }, []);

  useEffect(() => {
    const isSupported = typeof window !== 'undefined'
      && typeof navigator !== 'undefined'
      && typeof navigator.mediaDevices?.getUserMedia === 'function'
      && typeof MediaRecorder !== 'undefined';

    setState((current) => ({
      ...current,
      isSupported,
    }));
  }, []);

  useEffect(() => () => {
    cleanupMedia();
  }, [cleanupMedia]);

  return {
    ...state,
    startRecording,
    stopRecording,
    clearAudio,
    clearError,
  };
}

