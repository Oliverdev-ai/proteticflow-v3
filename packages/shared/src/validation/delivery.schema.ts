import { z } from 'zod';

export const createDeliveryScheduleSchema = z.object({
  date: z.string().datetime(),
  driverName: z.string().max(255).optional(),
  vehicle: z.string().max(128).optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    stopType: z.enum(['delivery', 'pickup']).default('delivery'),
    jobId: z.number().int().positive().optional(),
    clientId: z.number().int().positive(),
    deliveryAddress: z.string().min(3).max(2000),
    sortOrder: z.number().int().min(0).default(0),
    notes: z.string().optional(),
  }).superRefine((item, ctx) => {
    if (item.stopType === 'delivery' && !item.jobId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Paradas de entrega exigem OS vinculada',
        path: ['jobId'],
      });
    }
  })).min(1, 'Roteiro deve ter pelo menos 1 parada'),
});

export const updateDeliveryItemStatusSchema = z.object({
  itemId: z.number().int().positive(),
  status: z.enum(['scheduled', 'in_transit', 'delivered', 'failed']),
  failedReason: z.string().optional(),
  notes: z.string().optional(),
});

export const listDeliverySchedulesSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type CreateDeliveryScheduleInput = z.infer<typeof createDeliveryScheduleSchema>;
export type UpdateDeliveryItemStatusInput = z.infer<typeof updateDeliveryItemStatusSchema>;
export type ListDeliverySchedulesInput = z.infer<typeof listDeliverySchedulesSchema>;
