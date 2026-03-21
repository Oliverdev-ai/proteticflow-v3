import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  numeric,
  index,
} from 'drizzle-orm/pg-core';

// Enums
export const arStatusEnum = pgEnum('ar_status', ['pending', 'paid', 'overdue', 'cancelled']);
export const apStatusEnum = pgEnum('ap_status', ['pending', 'paid', 'overdue', 'cancelled']);
export const closingStatusEnum = pgEnum('closing_status', ['open', 'closed', 'paid']);

// Tables
export const accountsReceivable = pgTable('accounts_receivable', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  jobId: integer('job_id').notNull(),
  clientId: integer('client_id').notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  description: varchar('description', { length: 512 }),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  status: arStatusEnum('status').default('pending').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ar_tenant_idx').on(table.tenantId),
  index('ar_client_idx').on(table.clientId),
  index('ar_status_idx').on(table.status),
]);

export const financialClosings = pgTable('financial_closings', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  clientId: integer('client_id').notNull(),
  period: varchar('period', { length: 7 }).notNull(),
  totalJobs: integer('total_jobs').default(0).notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  pendingAmount: numeric('pending_amount', { precision: 12, scale: 2 }).default('0').notNull(),
  status: closingStatusEnum('status').default('open').notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('closing_tenant_idx').on(table.tenantId),
  index('closing_client_period_idx').on(table.clientId, table.period),
]);

export const accountsPayable = pgTable('accounts_payable', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  description: varchar('description', { length: 512 }).notNull(),
  supplier: varchar('supplier', { length: 255 }),
  category: varchar('category', { length: 128 }),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  status: apStatusEnum('status').default('pending').notNull(),
  notes: text('notes'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ap_tenant_idx').on(table.tenantId),
  index('ap_status_idx').on(table.status),
  index('ap_due_date_idx').on(table.dueDate),
]);
