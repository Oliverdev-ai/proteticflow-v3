import { z } from 'zod';
import { JOB_STATUS } from '../constants/job-status';

export const aiToolPeriodSchema = z.enum([
  'today',
  'week',
  'month',
  'quarter',
  'year',
  'custom',
]);

export const aiToolDeliveryDateSchema = z.union([
  z.string().datetime(),
  z.literal('hoje'),
  z.literal('amanha'),
  z.literal('amanhã'),
]);

export const aiToolChannelSchema = z.enum(['whatsapp', 'email', 'sms']);

export const aiToolFinancialBreakdownSchema = z.enum(['by_service', 'by_client', 'none']);

export const aiToolEmployeeMetricSchema = z.enum([
  'jobs_completed',
  'value_produced',
  'avg_time_per_job',
]);

export const aiToolEmployeePeriodSchema = z.enum(['today', 'week', 'month', 'quarter']);

export const stockCheckMaterialSchema = z.object({
  materialId: z.number().int().positive().optional(),
  materialName: z.string().min(2).max(120).optional(),
  unit: z.string().max(32).optional(),
}).refine((value) => value.materialId !== undefined || value.materialName !== undefined, {
  message: 'Informe materialId ou materialName',
  path: ['materialName'],
});

export const stockAlertsSchema = z.object({
  thresholdType: z.enum(['reorder_level', 'critical', 'all']).default('reorder_level'),
});

export const deliveriesRouteByDaySchema = z.object({
  date: aiToolDeliveryDateSchema.optional(),
  deliveryPersonId: z.number().int().positive().nullable().optional(),
  deliveryPersonName: z.string().min(2).max(120).optional(),
});

export const employeesProductivitySchema = z.object({
  employeeId: z.number().int().positive().nullable().optional(),
  employeeName: z.string().min(2).max(120).optional(),
  period: aiToolEmployeePeriodSchema.default('week'),
  metric: aiToolEmployeeMetricSchema.default('jobs_completed'),
});

export const financialRevenueToDateSchema = z.object({
  period: aiToolPeriodSchema.default('month'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  breakdown: aiToolFinancialBreakdownSchema.default('none'),
});

export const financialExpensesToDateSchema = z.object({
  period: aiToolPeriodSchema.default('month'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  breakdown: z.enum(['by_category', 'none']).default('none'),
});

export const financialQuarterlyReportSchema = z.object({
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  exportFormat: z.enum(['pdf', 'xlsx', 'inline']).default('inline'),
});

export const agendaTodaySchema = z.object({
  userId: z.number().int().positive().optional(),
  scope: z.enum(['own', 'all']).default('own'),
});

export const jobsOverdueSchema = z.object({
  severity: z.enum(['all', 'critical']).default('all'),
  assignedTo: z.number().int().positive().nullable().optional(),
});

export const messagesDraftToClientSchema = z.object({
  clientId: z.number().int().positive().optional(),
  clientName: z.string().min(2).max(120).optional(),
  messageContext: z.string().min(3).max(600),
  channel: aiToolChannelSchema.optional(),
  jobId: z.number().int().positive().optional(),
}).refine((value) => value.clientId !== undefined || value.clientName !== undefined, {
  message: 'Informe clientId ou clientName',
  path: ['clientName'],
});

const aiToolJobStatusValues = [
  JOB_STATUS.PENDING,
  JOB_STATUS.IN_PROGRESS,
  JOB_STATUS.QUALITY_CHECK,
  JOB_STATUS.READY,
  JOB_STATUS.REWORK_IN_PROGRESS,
  JOB_STATUS.SUSPENDED,
  JOB_STATUS.DELIVERED,
  JOB_STATUS.CANCELLED,
] as const;

export const jobsStatusUpdateSchema = z.object({
  jobId: z.number().int().positive(),
  newStatus: z.enum(aiToolJobStatusValues),
  note: z.string().max(600).optional(),
  cancelReason: z.string().max(600).optional(),
}).refine((value) => value.newStatus !== JOB_STATUS.CANCELLED || Boolean(value.cancelReason), {
  message: 'cancelReason obrigatoria quando newStatus = cancelled',
  path: ['cancelReason'],
});

export type StockCheckMaterialInput = z.infer<typeof stockCheckMaterialSchema>;
export type StockAlertsInput = z.infer<typeof stockAlertsSchema>;
export type DeliveriesRouteByDayInput = z.infer<typeof deliveriesRouteByDaySchema>;
export type EmployeesProductivityInput = z.infer<typeof employeesProductivitySchema>;
export type FinancialRevenueToDateInput = z.infer<typeof financialRevenueToDateSchema>;
export type FinancialExpensesToDateInput = z.infer<typeof financialExpensesToDateSchema>;
export type FinancialQuarterlyReportInput = z.infer<typeof financialQuarterlyReportSchema>;
export type AgendaTodayInput = z.infer<typeof agendaTodaySchema>;
export type JobsOverdueInput = z.infer<typeof jobsOverdueSchema>;
export type MessagesDraftToClientInput = z.infer<typeof messagesDraftToClientSchema>;
export type JobsStatusUpdateInput = z.infer<typeof jobsStatusUpdateSchema>;
