import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD');
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora deve estar no formato HH:mm');

export const clockInSchema = z.object({
  employeeId: z.number().int().positive(),
  date: dateSchema,
  time: timeSchema,
  notes: z.string().max(1000).optional(),
});

export const clockOutSchema = z.object({
  employeeId: z.number().int().positive(),
  date: dateSchema,
  time: timeSchema,
  notes: z.string().max(1000).optional(),
});

export const timesheetFilterSchema = z.object({
  employeeId: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

export const monthFilterSchema = timesheetFilterSchema.pick({
  employeeId: true,
  month: true,
  year: true,
});
