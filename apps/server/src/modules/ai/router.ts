import { z } from 'zod';
import {
  archiveSessionSchema,
  createSessionSchema,
  listSessionsSchema,
  sendMessageSchema,
} from '@proteticflow/shared';
import { router, tenantProcedure } from '../../trpc/trpc.js';
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
});
