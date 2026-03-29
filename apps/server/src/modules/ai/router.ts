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

const getSessionSchema = z.object({
  sessionId: z.number().int().positive(),
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
