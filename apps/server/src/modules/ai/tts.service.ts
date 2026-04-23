import { TRPCError } from '@trpc/server';
import { PLAN_AI_CONFIG, PLAN_TIER, type PlanTier } from '@proteticflow/shared';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { ttsUsage } from '../../db/schema/ai.js';
import { tenants } from '../../db/schema/tenants.js';
import { env } from '../../env.js';
import { logger } from '../../logger.js';
import { toTtsSsml } from './tts-ssml.js';

export type TtsVoice = 'female' | 'male';

export interface SynthesizeOptions {
  text: string;
  voice?: TtsVoice;
  speakingRate?: number;
  pitch?: number;
  ssml?: boolean;
  charactersBilled?: number;
}

export interface SynthesizeResult {
  audioBase64: string;
  audioBytes: number;
  charactersBilled: number;
}

export type TtsStreamChunk = {
  chunk: string;
  text: string;
  isFinal: boolean;
};

const GOOGLE_TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const DEFAULT_FEMALE_VOICE = 'pt-BR-Chirp3-HD-Achernar';
const DEFAULT_MALE_VOICE = 'pt-BR-Chirp3-HD-Charon';

type TenantPlanRow = {
  plan: string;
};

function clampSpeakingRate(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 1.0;
  return Math.max(0.25, Math.min(4.0, value));
}

function clampPitch(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.max(-20, Math.min(20, value));
}

function getConfiguredVoice(voice: TtsVoice | undefined): string {
  if (voice === 'male') {
    return env.GCP_TTS_VOICE_MALE ?? DEFAULT_MALE_VOICE;
  }
  return env.GCP_TTS_VOICE_DEFAULT ?? DEFAULT_FEMALE_VOICE;
}

function resolvePlanTier(plan: string): PlanTier {
  if (plan === PLAN_TIER.STARTER || plan === PLAN_TIER.PRO || plan === PLAN_TIER.ENTERPRISE) {
    return plan;
  }
  return PLAN_TIER.TRIAL;
}

function assertTtsConfiguration(): string | null {
  if (!env.GCP_TTS_API_KEY) {
    return null;
  }
  return env.GCP_TTS_API_KEY;
}

async function fetchTenantPlan(tenantId: number): Promise<PlanTier> {
  const [tenant]: TenantPlanRow[] = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Tenant nao encontrado' });
  }

  return resolvePlanTier(tenant.plan);
}

export async function assertTtsPlanEnabled(tenantId: number): Promise<PlanTier> {
  const plan = await fetchTenantPlan(tenantId);
  if (!PLAN_AI_CONFIG[plan].ttsEnabled) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Resposta por voz disponivel a partir do plano Starter.',
    });
  }
  return plan;
}

export async function logTtsUsage(input: {
  tenantId: number;
  userId: number;
  charactersBilled: number;
  audioBytes: number;
  voice: TtsVoice;
  source?: string;
}): Promise<void> {
  const source = input.source ?? 'ai.tts';

  await db.insert(ttsUsage).values({
    tenantId: input.tenantId,
    userId: input.userId,
    charactersBilled: input.charactersBilled,
    audioBytes: input.audioBytes,
    voice: input.voice,
    source,
  }).catch((error: unknown) => {
    logger.warn(
      {
        action: 'ai.tts.usage_log.failed',
        tenantId: input.tenantId,
        userId: input.userId,
        source,
        err: error,
      },
      'Falha ao registrar uso de TTS',
    );
  });
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

type TtsSynthesizeResponse = {
  audioContent?: string;
};

export async function synthesize(options: SynthesizeOptions): Promise<SynthesizeResult | null> {
  const apiKey = assertTtsConfiguration();
  if (!apiKey) {
    return null;
  }

  const voice = options.voice ?? 'female';
  const plainText = options.text.trim();
  if (plainText.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Texto de TTS vazio' });
  }

  const textForSynthesis = options.ssml ? plainText : toTtsSsml(plainText);
  const requestBody = {
    input: { ssml: textForSynthesis },
    voice: {
      languageCode: 'pt-BR',
      name: getConfiguredVoice(voice),
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: clampSpeakingRate(options.speakingRate),
      pitch: clampPitch(options.pitch),
    },
  };

  const response = await fetch(`${GOOGLE_TTS_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    logger.error(
      {
        action: 'ai.tts.synthesize.http_error',
        status: response.status,
        statusText: response.statusText,
        errorText,
      },
      'Falha HTTP no Google TTS',
    );
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Nao foi possivel sintetizar audio no momento.',
    });
  }

  const payload = await response.json() as TtsSynthesizeResponse;
  if (!payload.audioContent) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Google TTS retornou audio vazio.',
    });
  }

  const audioBytes = Buffer.from(payload.audioContent, 'base64').length;
  return {
    audioBase64: payload.audioContent,
    audioBytes,
    charactersBilled: options.charactersBilled ?? plainText.length,
  };
}

export async function* synthesizeStream(
  options: SynthesizeOptions,
): AsyncGenerator<TtsStreamChunk> {
  const sentences = splitIntoSentences(options.text);
  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index]!;
    const synthesized = await synthesize({
      ...options,
      text: sentence,
      charactersBilled: sentence.length,
    });

    if (!synthesized) {
      return;
    }

    yield {
      chunk: synthesized.audioBase64,
      text: sentence,
      isFinal: index === sentences.length - 1,
    };
  }
}

export async function fetchRecentTtsUsage(
  tenantId: number,
  userId: number,
): Promise<Array<{ id: number; charactersBilled: number; createdAt: Date }>> {
  const rows = await db
    .select({
      id: ttsUsage.id,
      charactersBilled: ttsUsage.charactersBilled,
      createdAt: ttsUsage.createdAt,
    })
    .from(ttsUsage)
    .where(and(eq(ttsUsage.tenantId, tenantId), eq(ttsUsage.userId, userId)))
    .orderBy(ttsUsage.id)
    .limit(20);

  return rows;
}
