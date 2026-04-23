import type { AiMessage, PlanTier, Role } from '@proteticflow/shared';
import { streamAiResponse, type StreamChunk } from './flow-engine.js';
import { synthesize, type TtsVoice } from './tts.service.js';

export type VoiceStreamChunk =
  | { type: 'text'; text: string }
  | { type: 'audio'; audioBase64: string; text: string; isFinal: boolean }
  | { type: 'done'; commandDetected: string | null; tokensUsed: number };

const SENTENCE_DELIMITER = /(?<=[.!?])\s+/;

function splitCompletedSentences(buffer: string): { completed: string[]; remainder: string } {
  const parts = buffer.split(SENTENCE_DELIMITER);
  if (parts.length <= 1) {
    return { completed: [], remainder: buffer };
  }

  const remainder = parts.pop() ?? '';
  const completed = parts.filter((part) => part.trim().length > 0);
  return { completed, remainder };
}

async function* emitAudioForSentence(sentence: string, voice: TtsVoice): AsyncGenerator<VoiceStreamChunk> {
  const synthesized = await synthesize({
    text: sentence,
    voice,
    speakingRate: 1,
    ssml: false,
  });

  if (!synthesized) {
    return;
  }

  yield {
    type: 'audio',
    audioBase64: synthesized.audioBase64,
    text: sentence,
    isFinal: false,
  };
}

export async function* streamVoiceResponse(
  tenantId: number,
  userRole: Role,
  userMessage: string,
  history: AiMessage[],
  userId: number,
  tenantPlan: PlanTier,
  sessionId?: number,
): AsyncGenerator<VoiceStreamChunk> {
  const preferredVoice: TtsVoice = tenantPlan === 'enterprise' ? 'male' : 'female';
  let buffer = '';

  for await (const chunk of streamAiResponse(
    tenantId,
    userRole,
    userMessage,
    history,
    userId,
    sessionId,
  )) {
    if (chunk.type === 'delta') {
      buffer += chunk.text;
      yield { type: 'text', text: chunk.text };

      const { completed, remainder } = splitCompletedSentences(buffer);
      buffer = remainder;

      for (const sentence of completed) {
        for await (const audioChunk of emitAudioForSentence(sentence, preferredVoice)) {
          yield audioChunk;
        }
      }
      continue;
    }

    if (buffer.trim().length > 0) {
      const finalAudio = await synthesize({
        text: buffer,
        voice: preferredVoice,
        ssml: false,
      });

      if (finalAudio) {
        yield {
          type: 'audio',
          audioBase64: finalAudio.audioBase64,
          text: buffer,
          isFinal: true,
        };
      }
      buffer = '';
    }

    yield {
      type: 'done',
      commandDetected: chunk.commandDetected,
      tokensUsed: chunk.tokensUsed,
    };
  }
}

export type { StreamChunk };
