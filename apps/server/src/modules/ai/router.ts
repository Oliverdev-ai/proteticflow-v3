import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  aiFeatureFlagsSchema,
  archiveSessionSchema,
  createSessionSchema,
  getAiSnapshotSchema,
  listSessionsSchema,
  listAiPredictionsSchema,
  listAiRecommendationsSchema,
  recordAiFeedbackSchema,
  runForecastsSchema,
  sendMessageSchema,
} from '@proteticflow/shared';
import {
  aiAdminProcedure,
  aiFullAdminProcedure,
  aiFullProcedure,
  aiProcedure,
  tenantProcedure,
  router,
  voiceProcedure,
} from '../../trpc/trpc.js';
import * as aiService from './service.js';
import { buildLabContext } from './context-builder.js';
import { streamAiResponse } from './flow-engine.js';
import { applyRateLimitHeaders, checkTtsRateLimit } from './rate-limit.js';
import { assertTtsPlanEnabled, logTtsUsage, synthesize, type TtsVoice } from './tts.service.js';
import { transcribeAudio } from './voice.service.js';
import * as lgpdService from './lgpd.service.js';
import {
  MEMORY_CATEGORIES,
  MEMORY_SCOPES,
  memoryService,
} from './memory.service.js';
import { getUserPreferences, isWithinQuietHours } from '../proactive/preferences.service.js';

const getSessionSchema = z.object({
  sessionId: z.number().int().positive(),
});

const executeCommandSchema = z.object({
  sessionId: z.number().int().positive().optional(),
  content: z.string().min(1).max(4000),
  channel: z.enum(['text', 'voice']).default('text'),
});

const confirmCommandSchema = z.object({
  commandRunId: z.number().int().positive(),
});

const resolveCommandStepSchema = z.object({
  commandRunId: z.number().int().positive(),
  values: z.record(z.string(), z.unknown()).default({}),
});

const cancelCommandSchema = z.object({
  commandRunId: z.number().int().positive(),
});

const listCommandRunsSchema = z.object({
  sessionId: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.number().int().positive().optional(),
});

const transcribeSchema = z.object({
  audio: z.string().min(1),
  mimeType: z.string().min(1).max(128),
  durationMs: z.number().int().positive().max(60_000).optional(),
});

const ttsSchema = z.object({
  text: z.string().min(1).max(5_000),
  voice: z.enum(['female', 'male']).optional(),
  speakingRate: z.number().min(0.25).max(4).optional(),
  ssml: z.boolean().default(false),
});

const memoryCategorySchema = z.enum(MEMORY_CATEGORIES);
const memoryScopeSchema = z.enum(MEMORY_SCOPES);
const memoryValueJsonSchema = z.preprocess(
  (value) => (typeof value === 'string' ? { value } : value),
  z.record(z.string(), z.unknown()),
);

const memorySettingsSchema = z.object({
  enabled: z.boolean().optional(),
  paused: z.boolean().optional(),
});

const memoryListSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  category: memoryCategorySchema.optional(),
  scope: memoryScopeSchema.optional(),
  entityType: z.string().trim().min(1).max(64).optional(),
  entityId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().min(1).max(500).optional(),
});

const memoryRememberSchema = z.object({
  scope: memoryScopeSchema.default('user'),
  category: memoryCategorySchema.default('general'),
  keyText: z.string().trim().min(2).max(500),
  valueJson: memoryValueJsonSchema,
  entityType: z.string().trim().min(1).max(64).nullable().optional(),
  entityId: z.coerce.number().int().positive().nullable().optional(),
  ttlDays: z.coerce.number().int().min(1).max(365).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
});

const memoryRecallSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  category: memoryCategorySchema.optional(),
  entityType: z.string().trim().min(1).max(64).optional(),
  entityId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

const memoryIdSchema = z.object({
  memoryId: z.string().uuid(),
});

const memoryUpdateSchema = memoryIdSchema.extend({
  keyText: z.string().trim().min(2).max(500).optional(),
  valueJson: memoryValueJsonSchema.optional(),
  category: memoryCategorySchema.optional(),
  entityType: z.string().trim().min(1).max(64).nullable().optional(),
  entityId: z.coerce.number().int().positive().nullable().optional(),
  ttlDays: z.coerce.number().int().min(1).max(365).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
});

const memoryRenewSchema = memoryIdSchema.extend({
  ttlDays: z.coerce.number().int().min(1).max(365).default(180),
});

const memoryForgetAllSchema = z.object({
  confirmText: z.literal('CONFIRMAR'),
});

async function assertAssistantOutOfQuietMode(tenantId: number, userId: number): Promise<void> {
  const preferences = await getUserPreferences(tenantId, userId);
  if (preferences.quietModeEnabled && isWithinQuietHours({
    quietHoursStart: preferences.quietModeStart,
    quietHoursEnd: preferences.quietModeEnd,
  })) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Assistente em quiet mode. Tente novamente mais tarde.',
    });
  }
}

export const aiRouter = router({
  createSession: aiProcedure
    .input(createSessionSchema)
    .mutation(({ ctx, input }) => aiService.createSession(ctx.tenantId!, ctx.user!.id, input)),

  listSessions: aiProcedure
    .input(listSessionsSchema)
    .query(({ ctx, input }) => aiService.listSessions(ctx.tenantId!, ctx.user!.id, input)),

  getSession: aiProcedure
    .input(getSessionSchema)
    .query(({ ctx, input }) => aiService.getSession(ctx.tenantId!, input.sessionId, ctx.user!.id)),

  archiveSession: aiProcedure
    .input(archiveSessionSchema)
    .mutation(({ ctx, input }) => aiService.archiveSession(ctx.tenantId!, ctx.user!.id, input)),

  sendMessage: aiProcedure
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
      await assertAssistantOutOfQuietMode(ctx.tenantId!, ctx.user!.id);
      const history = await aiService.getRecentMessages(ctx.tenantId!, input.sessionId, ctx.user!.id, 10);

      await aiService.saveMessage(
        ctx.tenantId!,
        input.sessionId,
        ctx.user!.id,
        'user',
        input.content,
      );

      let assistantText = '';
      let commandDetected: string | null = null;
      let tokensUsed = 0;

      for await (const chunk of streamAiResponse(
        ctx.tenantId!,
        ctx.user!.role,
        input.content,
        history,
        ctx.user!.id,
        input.sessionId,
      )) {
        if (chunk.type === 'delta') {
          assistantText += chunk.text;
        } else {
          commandDetected = chunk.commandDetected;
          tokensUsed = chunk.tokensUsed;
        }
      }

      const assistantMessage = await aiService.saveMessage(
        ctx.tenantId!,
        input.sessionId,
        ctx.user!.id,
        'assistant',
        assistantText.trim(),
        commandDetected,
        tokensUsed,
      );

      return {
        sessionId: input.sessionId,
        message: assistantMessage,
        commandDetected,
        tokensUsed,
      };
    }),

  executeCommand: aiProcedure
    .input(executeCommandSchema)
    .mutation(async ({ ctx, input }) => {
      await assertAssistantOutOfQuietMode(ctx.tenantId!, ctx.user!.id);
      const response = await aiService.executeCommand(ctx.tenantId!, ctx.user!.id, ctx.user!.role, input);
      applyRateLimitHeaders(ctx.res, response.rateLimit);
      return response;
    }),

  lgpd: router({
    requestExport: tenantProcedure
      .mutation(({ ctx }) => lgpdService.requestLgpdExport(ctx.tenantId!, ctx.user!.id)),

    requestDelete: tenantProcedure
      .mutation(({ ctx }) => lgpdService.requestLgpdDelete(ctx.tenantId!, ctx.user!.id)),
  }),

  memory: router({
    settings: tenantProcedure
      .query(({ ctx }) => memoryService.getSettings({ tenantId: ctx.tenantId!, userId: ctx.user!.id, role: ctx.user!.role })),

    updateSettings: aiAdminProcedure
      .input(memorySettingsSchema)
      .mutation(({ ctx, input }) =>
        memoryService.updateSettings({ tenantId: ctx.tenantId!, userId: ctx.user!.id, role: ctx.user!.role }, input)),

    list: tenantProcedure
      .input(memoryListSchema)
      .query(({ ctx, input }) =>
        memoryService.list({ tenantId: ctx.tenantId!, userId: ctx.user!.id, role: ctx.user!.role }, input)),

    recall: tenantProcedure
      .input(memoryRecallSchema)
      .query(({ ctx, input }) =>
        memoryService.recall({ tenantId: ctx.tenantId!, userId: ctx.user!.id, role: ctx.user!.role }, input)),

    remember: aiAdminProcedure
      .input(memoryRememberSchema)
      .mutation(({ ctx, input }) =>
        memoryService.remember(
          { tenantId: ctx.tenantId!, userId: ctx.user!.id, role: ctx.user!.role },
          {
            scope: input.scope,
            category: input.category,
            keyText: input.keyText,
            valueJson: input.valueJson,
            entityType: input.entityType ?? null,
            entityId: input.entityId ?? null,
            source: 'manual',
            confidence: input.confidence,
            ttlDays: input.ttlDays,
          },
        )),

    update: aiAdminProcedure
      .input(memoryUpdateSchema)
      .mutation(({ ctx, input }) =>
        memoryService.update(
          { tenantId: ctx.tenantId!, userId: ctx.user!.id, role: ctx.user!.role },
          input.memoryId,
          {
            keyText: input.keyText,
            valueJson: input.valueJson,
            category: input.category,
            entityType: input.entityType,
            entityId: input.entityId,
            confidence: input.confidence,
            ttlDays: input.ttlDays,
          },
        )),

    renew: aiAdminProcedure
      .input(memoryRenewSchema)
      .mutation(({ ctx, input }) =>
        memoryService.renew(
          { tenantId: ctx.tenantId!, userId: ctx.user!.id, role: ctx.user!.role },
          input.memoryId,
          input.ttlDays,
        )),

    forget: aiAdminProcedure
      .input(memoryIdSchema)
      .mutation(async ({ ctx, input }) => {
        await memoryService.forget({ tenantId: ctx.tenantId!, userId: ctx.user!.id, role: ctx.user!.role }, input.memoryId);
        return { success: true };
      }),

    forgetAll: aiAdminProcedure
      .input(memoryForgetAllSchema)
      .mutation(({ ctx }) => memoryService.forgetAll({ tenantId: ctx.tenantId!, userId: ctx.user!.id, role: ctx.user!.role })),

    exportJson: tenantProcedure
      .query(({ ctx }) => memoryService.exportJson({ tenantId: ctx.tenantId!, userId: ctx.user!.id, role: ctx.user!.role })),
  }),

  resolveCommandStep: aiProcedure
    .input(resolveCommandStepSchema)
    .mutation(async ({ ctx, input }) => {
      const response = await aiService.resolveCommandStep(ctx.tenantId!, ctx.user!.id, ctx.user!.role, input);
      applyRateLimitHeaders(ctx.res, response.rateLimit);
      return response;
    }),

  confirmCommand: aiProcedure
    .input(confirmCommandSchema)
    .mutation(async ({ ctx, input }) => {
      const response = await aiService.confirmCommand(ctx.tenantId!, ctx.user!.id, ctx.user!.role, input);
      applyRateLimitHeaders(ctx.res, response.rateLimit);
      return response;
    }),

  cancelCommand: aiProcedure
    .input(cancelCommandSchema)
    .mutation(({ ctx, input }) => aiService.cancelCommand(ctx.tenantId!, ctx.user!.id, input)),

  listCommandRuns: aiProcedure
    .input(listCommandRunsSchema)
    .query(({ ctx, input }) => aiService.listCommandRuns(ctx.tenantId!, ctx.user!.id, input)),

  transcribe: voiceProcedure
    .input(transcribeSchema)
    .mutation(({ ctx, input }) => {
      const payload = {
        audioBuffer: Buffer.from(input.audio, 'base64'),
        mimeType: input.mimeType,
        tenantId: ctx.tenantId!,
        userId: ctx.user!.id,
        ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
      };

      return transcribeAudio(payload);
    }),

  tts: voiceProcedure
    .input(ttsSchema)
    .mutation(async ({ ctx, input }) => {
      const ttsRateLimit = await checkTtsRateLimit(ctx.tenantId!, ctx.user!.id);
      applyRateLimitHeaders(ctx.res, ttsRateLimit);
      await assertTtsPlanEnabled(ctx.tenantId!);

      const synthesizePayload = {
        text: input.text,
        ssml: input.ssml,
        charactersBilled: input.text.length,
        ...(input.voice !== undefined ? { voice: input.voice } : {}),
        ...(input.speakingRate !== undefined ? { speakingRate: input.speakingRate } : {}),
      };

      const result = await synthesize(synthesizePayload);

      if (!result) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'TTS indisponivel: configure GCP_TTS_API_KEY neste ambiente.',
        });
      }

      await logTtsUsage({
        tenantId: ctx.tenantId!,
        userId: ctx.user!.id,
        charactersBilled: result.charactersBilled,
        audioBytes: result.audioBytes,
        voice: (input.voice ?? 'female') as TtsVoice,
      });

      return result;
    }),

  getLabContext: aiProcedure
    .query(({ ctx }) => buildLabContext(ctx.tenantId!)),

  getCapabilities: aiProcedure
    .query(({ ctx }) => aiService.getAICapabilities(ctx.tenantId!)),

  updateSettings: aiAdminProcedure
    .input(aiFeatureFlagsSchema)
    .mutation(({ ctx, input }) => aiService.updateTenantAISettings(ctx.tenantId!, input)),

  listPredictions: aiFullProcedure
    .input(listAiPredictionsSchema)
    .query(({ ctx, input }) => aiService.listPredictions(ctx.tenantId!, input)),

  listRecommendations: aiFullProcedure
    .input(listAiRecommendationsSchema)
    .query(({ ctx, input }) => aiService.listRecommendations(ctx.tenantId!, input)),

  recordFeedback: aiFullProcedure
    .input(recordAiFeedbackSchema)
    .mutation(({ ctx, input }) => aiService.recordFeedback(ctx.tenantId!, ctx.user!.id, input)),

  listModelRuns: aiFullProcedure
    .query(({ ctx }) => aiService.listModelRuns(ctx.tenantId!)),

  getFeatureSnapshot: aiFullProcedure
    .input(getAiSnapshotSchema)
    .query(({ ctx, input }) => aiService.getFeatureSnapshot(ctx.tenantId!, input.id)),

  runRefresh: aiFullAdminProcedure
    .input(runForecastsSchema)
    .mutation(({ ctx, input }) => aiService.runDailyRefresh(ctx.tenantId!, input.force ? 'manual_force' : 'manual')),
});
