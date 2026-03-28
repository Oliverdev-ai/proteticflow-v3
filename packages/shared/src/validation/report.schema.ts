import { z } from 'zod';
import { REPORT_TYPES } from '../constants/report-types';

export const reportTypeSchema = z.enum(REPORT_TYPES);

export const reportPeriodSchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
});

export const reportFiltersSchema = reportPeriodSchema.extend({
  clientId: z.number().int().positive().optional(),
  employeeId: z.number().int().positive().optional(),
  supplierId: z.number().int().positive().optional(),
  status: z.string().max(64).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
  includeCharts: z.boolean().default(true),
  includeBreakdownByClient: z.boolean().default(true),
});

export const reportPreviewSchema = z.object({
  type: reportTypeSchema,
  filters: reportFiltersSchema,
});

export const reportGeneratePdfSchema = z.object({
  type: reportTypeSchema,
  filters: reportFiltersSchema,
  titleOverride: z.string().max(255).optional(),
});

export const reportExportCsvSchema = z.object({
  type: reportTypeSchema,
  filters: reportFiltersSchema,
});

export const reportSendByEmailSchema = z.object({
  type: reportTypeSchema,
  filters: reportFiltersSchema,
  to: z.string().email(),
  sendCsv: z.boolean().default(true),
  sendPdf: z.boolean().default(true),
});
