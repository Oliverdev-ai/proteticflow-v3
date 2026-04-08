import { z } from 'zod';
import {
  addTicketMessageSchema,
  createTicketSchema,
  listTicketsSchema,
  rateConversationSchema,
  sendChatMessageSchema,
  startConversationSchema,
  updateTicketSchema,
  upsertTemplateSchema,
} from '@proteticflow/shared';
import { adminProcedure, publicProcedure, router, tenantProcedure } from '../../trpc/trpc.js';
import * as supportService from './service.js';

export const supportRouter = router({
  startConversation: publicProcedure
    .input(startConversationSchema)
    .mutation(({ input }) => supportService.startConversation(input)),

  sendChatMessage: publicProcedure
    .input(sendChatMessageSchema)
    .mutation(({ input }) => supportService.sendChatMessage(input)),

  rateConversation: publicProcedure
    .input(rateConversationSchema)
    .mutation(({ input }) => supportService.rateConversation(input)),

  listTickets: tenantProcedure
    .input(listTicketsSchema)
    .query(({ ctx, input }) => supportService.listTickets(ctx.tenantId!, ctx.user!.id, input)),

  getTicket: tenantProcedure
    .input(z.object({ ticketId: z.number().int().positive() }))
    .query(({ ctx, input }) => supportService.getTicket(ctx.tenantId!, input.ticketId)),

  createTicket: tenantProcedure
    .input(createTicketSchema)
    .mutation(({ ctx, input }) => supportService.createTicket(ctx.tenantId!, ctx.user!.id, input)),

  updateTicket: tenantProcedure
    .input(updateTicketSchema)
    .mutation(({ ctx, input }) => supportService.updateTicket(ctx.tenantId!, ctx.user!.id, input)),

  addTicketMessage: tenantProcedure
    .input(addTicketMessageSchema)
    .mutation(({ ctx, input }) => supportService.addTicketMessage(ctx.tenantId!, ctx.user!.id, input)),

  listTemplates: tenantProcedure
    .query(({ ctx }) => supportService.listTemplates(ctx.tenantId!)),

  upsertTemplate: adminProcedure
    .input(upsertTemplateSchema)
    .mutation(({ ctx, input }) => supportService.upsertTemplate(ctx.tenantId!, ctx.user!.id, input)),

  deleteTemplate: adminProcedure
    .input(z.object({ templateId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => supportService.deleteTemplate(ctx.tenantId!, input.templateId)),
});
