import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['prova', 'entrega', 'retirada', 'reuniao', 'manutencao', 'outro']).default('outro'),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().default(false),
  jobId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().optional(),
  employeeId: z.number().int().positive().optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'biweekly', 'monthly']).default('none'),
  recurrenceEndDate: z.string().datetime().optional(),
  reminderMinutesBefore: z.number().int().min(0).default(60),
  color: z.string().max(7).optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const listEventsSchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  type: z.enum(['prova', 'entrega', 'retirada', 'reuniao', 'manutencao', 'outro']).optional(),
  employeeId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().optional(),
  jobId: z.number().int().positive().optional(),
});

export const moveEventSchema = z.object({
  eventId: z.number().int().positive(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export const EVENT_TYPE_LABELS: Record<string, string> = {
  prova: 'Prova de Trabalho',
  entrega: 'Entrega',
  retirada: 'Retirada',
  reuniao: 'Reuniao',
  manutencao: 'Manutencao',
  outro: 'Outro',
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  prova: '#f59e0b',
  entrega: '#10b981',
  retirada: '#3b82f6',
  reuniao: '#8b5cf6',
  manutencao: '#6b7280',
  outro: '#64748b',
};

