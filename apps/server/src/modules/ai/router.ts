import { z } from 'zod';
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
import { adminProcedure, router, tenantProcedure } from '../../trpc/trpc.js';
import * as aiService from './service.js';
import { buildLabContext } from './context-builder.js';
import { streamAiResponse } from './flow-engine.js';
import { transcribeAudio } from './voice.service.js';

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

export const aiRouter = router({
  createSession: tenantProcedure
    .input(createSessionSchema)
    .mutation(({ ctx, input }) => aiService.createSession(ctx.tenantId!, ctx.user!.id, input)),

  listSessions: tenantProcedure
    .input(listSessionsSchema)
    .query(({ ctx, input }) => aiService.listSessions(ctx.tenantId!, ctx.user!.id, input)),

  getSession: tenantProcedure
    .input(getSessionSchema)
    .query(({ ctx, input }) => aiService.getSession(ctx.tenantId!, input.sessionId, ctx.user!.id)),

  archiveSession: tenantProcedure
    .input(archiveSessionSchema)
    .mutation(({ ctx, input }) => aiService.archiveSession(ctx.tenantId!, ctx.user!.id, input)),

  // RBAC de comandos acontece internamente no detectCommand/flow-engine.
  // A procedure permanece tenantProcedure para permitir conversa livre.
  sendMessage: tenantProcedure
    .input(sendMessageSchema)
    .mutation(async ({ ctx, input }) => {
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

  executeCommand: tenantProcedure
    .input(executeCommandSchema)
    .mutation(({ ctx, input }) =>
      aiService.executeCommand(ctx.tenantId!, ctx.user!.id, ctx.user!.role, input)),

  resolveCommandStep: tenantProcedure
    .input(resolveCommandStepSchema)
    .mutation(({ ctx, input }) =>
      aiService.resolveCommandStep(ctx.tenantId!, ctx.user!.id, ctx.user!.role, input)),

  confirmCommand: tenantProcedure
    .input(confirmCommandSchema)
    .mutation(({ ctx, input }) =>
      aiService.confirmCommand(ctx.tenantId!, ctx.user!.id, ctx.user!.role, input)),

  cancelCommand: tenantProcedure
    .input(cancelCommandSchema)
    .mutation(({ ctx, input }) => aiService.cancelCommand(ctx.tenantId!, ctx.user!.id, input)),

  listCommandRuns: tenantProcedure
    .input(listCommandRunsSchema)
    .query(({ ctx, input }) => aiService.listCommandRuns(ctx.tenantId!, ctx.user!.id, input)),

  transcribe: tenantProcedure
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

  getLabContext: tenantProcedure
    .query(({ ctx }) => buildLabContext(ctx.tenantId!)),

  getCapabilities: tenantProcedure
    .query(({ ctx }) => aiService.getAICapabilities(ctx.tenantId!)),

  updateSettings: adminProcedure
    .input(aiFeatureFlagsSchema)
    .mutation(({ ctx, input }) => aiService.updateTenantAISettings(ctx.tenantId!, input)),

  listPredictions: tenantProcedure
    .input(listAiPredictionsSchema)
    .query(({ ctx, input }) => aiService.listPredictions(ctx.tenantId!, input)),

  listRecommendations: tenantProcedure
    .input(listAiRecommendationsSchema)
    .query(({ ctx, input }) => aiService.listRecommendations(ctx.tenantId!, input)),

  recordFeedback: tenantProcedure
    .input(recordAiFeedbackSchema)
    .mutation(({ ctx, input }) => aiService.recordFeedback(ctx.tenantId!, ctx.user!.id, input)),

  listModelRuns: tenantProcedure
    .query(({ ctx }) => aiService.listModelRuns(ctx.tenantId!)),

  getFeatureSnapshot: tenantProcedure
    .input(getAiSnapshotSchema)
    .query(({ ctx, input }) => aiService.getFeatureSnapshot(ctx.tenantId!, input.id)),

  runRefresh: adminProcedure
    .input(runForecastsSchema)
    .mutation(({ ctx, input }) => aiService.runDailyRefresh(ctx.tenantId!, input.force ? 'manual_force' : 'manual')),
});
