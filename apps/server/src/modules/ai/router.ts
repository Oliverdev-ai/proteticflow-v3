import { router, adminProcedure, tenantProcedure } from '../../trpc/trpc.js';
import {
  aiFeatureFlagsSchema,
  getAiSnapshotSchema,
  listAiPredictionsSchema,
  listAiRecommendationsSchema,
  recordAiFeedbackSchema,
  runForecastsSchema,
} from '@proteticflow/shared';
import * as aiService from './service.js';

export const aiRouter = router({
  getCapabilities: tenantProcedure.query(({ ctx }) => {
    return aiService.getAICapabilities(ctx.tenantId!);
  }),

  updateSettings: adminProcedure
    .input(aiFeatureFlagsSchema)
    .mutation(({ ctx, input }) => {
      return aiService.updateTenantAISettings(ctx.tenantId!, input);
    }),

  listPredictions: tenantProcedure
    .input(listAiPredictionsSchema)
    .query(({ ctx, input }) => {
      return aiService.listPredictions(ctx.tenantId!, input);
    }),

  listRecommendations: tenantProcedure
    .input(listAiRecommendationsSchema)
    .query(({ ctx, input }) => {
      return aiService.listRecommendations(ctx.tenantId!, input);
    }),

  recordFeedback: tenantProcedure
    .input(recordAiFeedbackSchema)
    .mutation(({ ctx, input }) => {
      return aiService.recordFeedback(ctx.tenantId!, ctx.user!.id, input);
    }),

  listModelRuns: tenantProcedure.query(({ ctx }) => {
    return aiService.listModelRuns(ctx.tenantId!);
  }),

  getFeatureSnapshot: tenantProcedure
    .input(getAiSnapshotSchema)
    .query(({ ctx, input }) => {
      return aiService.getFeatureSnapshot(ctx.tenantId!, input.id);
    }),

  runRefresh: adminProcedure
    .input(runForecastsSchema)
    .mutation(({ ctx, input }) => {
      return aiService.runDailyRefresh(ctx.tenantId!, input.force ? 'manual_force' : 'manual');
    }),
});
