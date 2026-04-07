import { z } from 'zod';

export const abcCurveTypeSchema = z.enum(['services', 'clients', 'materials', 'technicians']);

export const abcCurveInputSchema = z.object({
  type: abcCurveTypeSchema,
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export type AbcCurveInput = z.infer<typeof abcCurveInputSchema>;
export type AbcCurveType = z.infer<typeof abcCurveTypeSchema>;

