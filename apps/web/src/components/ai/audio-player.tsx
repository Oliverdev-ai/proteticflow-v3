import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';

type AudioChunk = {
  audioBase64: string;
  text: string;
};

interface AudioPlayerProps {
  audioChunks: AudioChunk[];
  autoPlay?: boolean;
  onEnded?: () => void;
}

type PlaybackMode = 'webaudio' | 'html-audio';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function canUseWebAudio(): boolean {
  return typeof window !== 'undefined' && typeof window.AudioContext !== 'undefined';
}

export function AudioPlayer({ audioChunks, autoPlay = true, onEnded }: AudioPlayerProps) {
  const [playbackMode] = useState<PlaybackMode>(canUseWebAudio() ? 'webaudio' : 'html-audio');
  const [nextIndex, setNextIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null);
  const pauseRequestedRef = useRef(false);

  const currentText = useMemo(() => {
    if (activeIndex === null) return null;
    return audioChunks[activeIndex]?.text ?? null;
  }, [activeIndex, audioChunks]);

  useEffect(() => {
    if (playbackMode !== 'webaudio') return;
    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }
    return () => {
      sourceNodeRef.current?.stop();
      sourceNodeRef.current = null;
      gainNodeRef.current = null;
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, [playbackMode]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : 1;
    }
    if (htmlAudioRef.current) {
      htmlAudioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (!autoPlay || isPaused || isPlaying) return;
    if (nextIndex >= audioChunks.length) return;

    const chunk = audioChunks[nextIndex];
    if (!chunk) return;

    let cancelled = false;

    const playWithWebAudio = async (): Promise<void> => {
      const context = audioContextRef.current;
      if (!context) {
        throw new Error('AudioContext indisponivel');
      }

      if (context.state === 'suspended') {
        await context.resume();
      }

      const arrayBuffer = base64ToArrayBuffer(chunk.audioBase64);
      const decoded = await context.decodeAudioData(arrayBuffer.slice(0));

      const source = context.createBufferSource();
      const gainNode = context.createGain();
      gainNode.gain.value = isMuted ? 0 : 1;

      source.buffer = decoded;
      source.connect(gainNode);
      gainNode.connect(context.destination);
      sourceNodeRef.current = source;
      gainNodeRef.current = gainNode;

      await new Promise<void>((resolve, reject) => {
        source.onended = () => resolve();
        try {
          source.start(0);
        } catch (error) {
          reject(error);
        }
      });
    };

    const playWithHtmlAudio = async (): Promise<void> => {
      const audio = new Audio(`data:audio/mpeg;base64,${chunk.audioBase64}`);
      htmlAudioRef.current = audio;
      audio.muted = isMuted;

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('Falha no playback HTMLAudio'));
        void audio.play().catch(reject);
      });
    };

    const playCurrentChunk = async () => {
      setIsPlaying(true);
      setActiveIndex(nextIndex);

      try {
        if (playbackMode === 'webaudio') {
          await playWithWebAudio();
        } else {
          await playWithHtmlAudio();
        }
      } finally {
        if (cancelled) return;

        if (pauseRequestedRef.current) {
          pauseRequestedRef.current = false;
          sourceNodeRef.current = null;
          gainNodeRef.current = null;
          htmlAudioRef.current = null;
          setIsPlaying(false);
          setActiveIndex(null);
          return;
        }

        sourceNodeRef.current = null;
        gainNodeRef.current = null;
        htmlAudioRef.current = null;
        setIsPlaying(false);
        setActiveIndex(null);
        setNextIndex((current) => current + 1);
      }
    };

    void playCurrentChunk();

    return () => {
      cancelled = true;
    };
  }, [audioChunks, autoPlay, isMuted, isPaused, isPlaying, nextIndex, playbackMode]);

  useEffect(() => {
    if (nextIndex < audioChunks.length) return;
    if (audioChunks.length === 0) return;
    if (isPlaying) return;
    onEnded?.();
  }, [audioChunks.length, isPlaying, nextIndex, onEnded]);

  function stopCurrentPlayback() {
    sourceNodeRef.current?.stop();
    sourceNodeRef.current = null;

    if (htmlAudioRef.current) {
      htmlAudioRef.current.pause();
      htmlAudioRef.current.currentTime = 0;
      htmlAudioRef.current = null;
    }

    setIsPlaying(false);
    setActiveIndex(null);
  }

  function handlePause() {
    if (!isPlaying || activeIndex === null) return;
    pauseRequestedRef.current = true;
    stopCurrentPlayback();
    setIsPaused(true);
  }

  function handleResume() {
    if (audioChunks.length === 0) return;
    setIsPaused(false);
  }

  if (audioChunks.length === 0) {
    return null;
  }

  return (
    <div
      data-audio-player
      className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-zinc-400">Resposta por voz</p>
          <p className="text-xs text-zinc-300">
            {isPlaying
              ? `Tocando trecho ${activeIndex !== null ? activeIndex + 1 : 1}/${audioChunks.length}`
              : isPaused
                ? 'Pausado'
                : 'Pronto'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isPaused ? handleResume : handlePause}
            disabled={!isPlaying && !isPaused}
            className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-200 hover:border-sky-500 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={isPaused ? 'Retomar audio' : 'Pausar audio'}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setIsMuted((current) => !current)}
            className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-200 hover:border-sky-500"
            aria-label={isMuted ? 'Ativar audio' : 'Silenciar audio'}
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
      </div>

      {currentText ? (
        <p className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
          {currentText}
        </p>
      ) : null}

      <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
        {audioChunks.map((chunk, index) => (
          <p
            key={`${index}-${chunk.text.slice(0, 16)}`}
            className={`text-[11px] ${
              index === activeIndex
                ? 'text-sky-200'
                : index < nextIndex
                  ? 'text-zinc-500'
                  : 'text-zinc-400'
            }`}
          >
            {chunk.text}
          </p>
        ))}
      </div>
    </div>
  );
}
