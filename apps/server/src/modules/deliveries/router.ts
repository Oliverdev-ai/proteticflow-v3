import { z } from 'zod';
import { router } from '../../trpc/trpc.js';
import { tenantProcedure } from '../../trpc/trpc.js';
import * as deliveryService from './service.js';
import {
  createDeliveryScheduleSchema,
  updateDeliveryItemStatusSchema,
  listDeliverySchedulesSchema,
} from '@proteticflow/shared';

export const deliveryRouter = router({
  createSchedule:   tenantProcedure.input(createDeliveryScheduleSchema).mutation(({ ctx, input }) =>
    deliveryService.createSchedule(ctx.user.tenantId, input, ctx.user.userId)),
  listSchedules:    tenantProcedure.input(listDeliverySchedulesSchema).query(({ ctx, input }) =>
    deliveryService.listSchedules(ctx.user.tenantId, input)),
  getSchedule:      tenantProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) =>
    deliveryService.getSchedule(ctx.user.tenantId, input.id)),
  updateItemStatus: tenantProcedure.input(updateDeliveryItemStatusSchema).mutation(({ ctx, input }) =>
    deliveryService.updateItemStatus(ctx.user.tenantId, input, ctx.user.userId)),
  markAllInTransit: tenantProcedure.input(z.object({ scheduleId: z.number() })).mutation(({ ctx, input }) =>
    deliveryService.markAllInTransit(ctx.user.tenantId, input.scheduleId, ctx.user.userId)),
  getReport:        tenantProcedure.input(z.object({ dateFrom: z.string(), dateTo: z.string() })).query(({ ctx, input }) =>
    deliveryService.getDeliveryReport(ctx.user.tenantId, new Date(input.dateFrom), new Date(input.dateTo))),
  generatePdf:      tenantProcedure.input(z.object({ scheduleId: z.number() })).query(({ ctx, input }) =>
    deliveryService.generateRoutePdf(ctx.user.tenantId, input.scheduleId)),
  groupByArea:      tenantProcedure.input(z.object({ jobIds: z.array(z.number()) })).query(({ ctx, input }) =>
    deliveryService.groupByNeighborhood(ctx.user.tenantId, input.jobIds)),
});
