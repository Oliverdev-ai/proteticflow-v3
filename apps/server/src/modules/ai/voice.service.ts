import { TRPCError } from '@trpc/server';
import { logger } from '../../logger.js';

const DEFAULT_STT_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
const DEFAULT_STT_MODEL = 'whisper-1';
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_MS = 60_000;

type TranscribeAudioInput = {
  audioBuffer: Buffer;
  mimeType: string;
  tenantId: number;
  userId: number;
  durationMs?: number;
};

type TranscribeAudioResult = {
  text: string;
  confidence?: number;
  durationMs?: number;
};

function resolveAudioExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('ogg')) return 'ogg';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('mp4')) return 'mp4';
  return 'webm';
}

function extractNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  return '';
}

function extractConfidence(payload: Record<string, unknown>): number | undefined {
  const direct = extractNumber(payload.confidence);
  if (direct !== undefined) {
    return Math.max(0, Math.min(1, direct));
  }

  const segments = payload.segments;
  if (!Array.isArray(segments) || segments.length === 0) return undefined;

  const probabilities = segments
    .map((segment) => {
      if (typeof segment !== 'object' || segment === null) return undefined;
      return extractNumber((segment as Record<string, unknown>).no_speech_prob);
    })
    .filter((value): value is number => typeof value === 'number');

  if (probabilities.length === 0) return undefined;
  const averageNoSpeech = probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length;
  const confidence = 1 - averageNoSpeech;
  return Math.max(0, Math.min(1, Number(confidence.toFixed(3))));
}

function parseProviderResponse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return { text: raw };
  } catch {
    return { text: raw };
  }
}

function fallbackTranscriptionError(): TRPCError {
  return new TRPCError({
    code: 'BAD_GATEWAY',
    message: 'Nao consegui entender o audio. Tente digitar.',
  });
}

export async function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioResult> {
  if (input.audioBuffer.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Audio vazio' });
  }
  if (input.audioBuffer.length > MAX_AUDIO_BYTES) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Audio excede o limite de 10MB' });
  }
  if (input.durationMs !== undefined && input.durationMs > MAX_DURATION_MS) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Audio excede o limite de 60 segundos' });
  }

  const apiKey = process.env.STT_API_KEY?.trim();
  if (!apiKey) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Transcricao por voz nao configurada',
    });
  }

  const apiUrl = process.env.STT_API_URL?.trim() || DEFAULT_STT_API_URL;
  const model = process.env.STT_MODEL?.trim() || DEFAULT_STT_MODEL;

  const formData = new FormData();
  const mimeType = input.mimeType.trim() || 'audio/webm';
  const extension = resolveAudioExtension(mimeType);
  const blob = new Blob([Uint8Array.from(input.audioBuffer)], { type: mimeType });
  formData.set('file', blob, `flow-audio.${extension}`);
  formData.set('model', model);
  formData.set('language', 'pt');
  formData.set('response_format', 'verbose_json');

  let responseText = '';
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    responseText = await response.text();
    if (!response.ok) {
      logger.warn({
        action: 'ai.voice.transcribe.error',
        tenantId: input.tenantId,
        userId: input.userId,
        statusCode: response.status,
      }, 'Falha no provedor de STT');
      throw fallbackTranscriptionError();
    }
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    logger.warn({
      action: 'ai.voice.transcribe.network_error',
      tenantId: input.tenantId,
      userId: input.userId,
      error: error instanceof Error ? error.message : 'unknown',
    }, 'Falha de rede no STT');
    throw fallbackTranscriptionError();
  }

  const payload = parseProviderResponse(responseText);
  const text = extractText(payload.text);
  if (!text) {
    throw fallbackTranscriptionError();
  }

  const providerDuration = extractNumber(payload.duration);
  const durationMs = input.durationMs ?? (providerDuration !== undefined ? Math.round(providerDuration * 1000) : undefined);
  const confidence = extractConfidence(payload);

  logger.info({
    action: 'ai.voice.transcribe',
    tenantId: input.tenantId,
    userId: input.userId,
    durationMs,
    confidence,
    charCount: text.length,
  }, 'Audio transcrito com sucesso');

  return {
    text,
    ...(confidence !== undefined ? { confidence } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}
