import { z } from 'zod';

export const createPayrollPeriodSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export const updatePayrollEntrySchema = z.object({
  entryId: z.number().int().positive(),
  overtimeHours: z.number().min(0).optional(),
  overtimeValueCents: z.number().int().min(0).optional(),
  bonusCents: z.number().int().min(0).optional(),
  discountsCents: z.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
});

export const closePayrollSchema = z.object({
  periodId: z.number().int().positive(),
});
