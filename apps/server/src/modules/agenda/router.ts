import { z } from 'zod';
import { router, tenantProcedure } from '../../trpc/trpc.js';
import {
  createEventSchema,
  listEventsSchema,
  moveEventSchema,
  updateEventSchema,
} from '@proteticflow/shared';
import * as agendaService from './service.js';

export const agendaRouter = router({
  create: tenantProcedure
    .input(createEventSchema)
    .mutation(({ ctx, input }) => agendaService.createEvent(ctx.tenantId!, input, ctx.user!.id)),

  list: tenantProcedure
    .input(listEventsSchema)
    .query(({ ctx, input }) => agendaService.listEvents(ctx.tenantId!, input)),

  get: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(({ ctx, input }) => agendaService.getEvent(ctx.tenantId!, input.id)),

  update: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }).merge(updateEventSchema))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return agendaService.updateEvent(ctx.tenantId!, id, data, ctx.user!.id);
    }),

  move: tenantProcedure
    .input(moveEventSchema)
    .mutation(({ ctx, input }) => agendaService.moveEvent(ctx.tenantId!, input, ctx.user!.id)),

  delete: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await agendaService.deleteEvent(ctx.tenantId!, input.id, ctx.user!.id);
      return { success: true };
    }),

  complete: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => agendaService.completeEvent(ctx.tenantId!, input.id, ctx.user!.id)),

  cancel: tenantProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => agendaService.cancelEvent(ctx.tenantId!, input.id, ctx.user!.id)),

  weekView: tenantProcedure
    .input(z.object({ weekStart: z.string().datetime() }))
    .query(({ ctx, input }) => agendaService.getWeekView(ctx.tenantId!, new Date(input.weekStart))),

  monthView: tenantProcedure
    .input(z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }))
    .query(({ ctx, input }) => agendaService.getMonthView(ctx.tenantId!, input.year, input.month)),

  employeeAgenda: tenantProcedure
    .input(z.object({
      employeeId: z.number().int().positive(),
      dateFrom: z.string().datetime(),
      dateTo: z.string().datetime(),
    }))
    .query(({ ctx, input }) => agendaService.getEmployeeAgenda(
      ctx.tenantId!,
      input.employeeId,
      new Date(input.dateFrom),
      new Date(input.dateTo),
    )),
});

