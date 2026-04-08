import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

export const eventTypeEnum = pgEnum('event_type', [
  'prova',
  'entrega',
  'retirada',
  'reuniao',
  'manutencao',
  'outro',
]);

export const recurrenceTypeEnum = pgEnum('recurrence_type', [
  'none',
  'daily',
  'weekly',
  'biweekly',
  'monthly',
]);

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  type: eventTypeEnum('event_type').default('outro').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  allDay: boolean('all_day').notNull().default(false),
  jobId: integer('job_id'),
  clientId: integer('client_id'),
  employeeId: integer('employee_id'),
  recurrence: recurrenceTypeEnum('recurrence').default('none').notNull(),
  recurrenceEndDate: timestamp('recurrence_end_date', { withTimezone: true }),
  parentEventId: integer('parent_event_id'),
  reminderMinutesBefore: integer('reminder_minutes_before').default(60),
  reminderSent: boolean('reminder_sent').notNull().default(false),
  isCompleted: boolean('is_completed').notNull().default(false),
  isCancelled: boolean('is_cancelled').notNull().default(false),
  color: varchar('color', { length: 7 }),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('events_tenant_idx').on(table.tenantId),
  index('events_start_idx').on(table.tenantId, table.startAt),
  index('events_job_idx').on(table.jobId),
  index('events_client_idx').on(table.clientId),
  index('events_employee_idx').on(table.employeeId),
]);

