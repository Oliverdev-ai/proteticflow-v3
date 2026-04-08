import { z } from 'zod';

export const fiscalGroupBySchema = z.enum(['month', 'client', 'serviceType', 'supplier', 'category']);

export const fiscalReportInputSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  groupBy: fiscalGroupBySchema.optional(),
}).superRefine((value, ctx) => {
  if (new Date(value.startDate) > new Date(value.endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['startDate'],
      message: 'startDate deve ser menor ou igual a endDate',
    });
  }
});

export const fiscalReportIdSchema = z.enum(['fiscal-revenue', 'fiscal-expenses', 'fiscal-dre']);

export const fiscalExportInputSchema = fiscalReportInputSchema.extend({
  reportId: fiscalReportIdSchema,
});

export type FiscalReportInput = z.infer<typeof fiscalReportInputSchema>;
export type FiscalReportId = z.infer<typeof fiscalReportIdSchema>;
export type FiscalExportInput = z.infer<typeof fiscalExportInputSchema>;
