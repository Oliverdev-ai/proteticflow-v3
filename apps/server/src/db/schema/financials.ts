import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// Enums
export const arStatusEnum = pgEnum('ar_status', ['pending', 'paid', 'overdue', 'cancelled']);
export const apStatusEnum = pgEnum('ap_status', ['pending', 'paid', 'overdue', 'cancelled']);
export const closingStatusEnum = pgEnum('closing_status', ['open', 'closed', 'paid']);
export const cashbookEntryTypeEnum = pgEnum('cashbook_entry_type', ['credit', 'debit']);

// Tables
export const accountsReceivable = pgTable('accounts_receivable', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  jobId: integer('job_id').notNull(),
  clientId: integer('client_id').notNull(),
  amountCents: integer('amount_cents').notNull(),
  description: varchar('description', { length: 512 }),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paymentMethod: varchar('payment_method', { length: 64 }),
  status: arStatusEnum('status').default('pending').notNull(),
  notes: text('notes'),
  cancelReason: text('cancel_reason'),
  cancelledBy: integer('cancelled_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ar_tenant_idx').on(table.tenantId),
  index('ar_client_idx').on(table.clientId),
  index('ar_status_idx').on(table.status),
  index('ar_due_date_idx').on(table.dueDate),
  index('ar_job_idx').on(table.jobId),
]);

export const financialClosings = pgTable('financial_closings', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  clientId: integer('client_id'), // null for global tenant closing
  period: varchar('period', { length: 7 }).notNull(),
  totalJobs: integer('total_jobs').default(0).notNull(),
  totalAmountCents: integer('total_amount_cents').notNull(),
  paidAmountCents: integer('paid_amount_cents').default(0).notNull(),
  pendingAmountCents: integer('pending_amount_cents').default(0).notNull(),
  status: closingStatusEnum('status').default('open').notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  breakdownJson: text('breakdown_json'),
  closedBy: integer('closed_by'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('closing_tenant_idx').on(table.tenantId),
  index('closing_client_period_idx').on(table.clientId, table.period),
  index('closing_period_idx').on(table.tenantId, table.period),
]);

export const accountsPayable = pgTable('accounts_payable', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  description: varchar('description', { length: 512 }).notNull(),
  supplierId: integer('supplier_id'),
  supplier: varchar('supplier', { length: 255 }),
  category: varchar('category', { length: 128 }),
  amountCents: integer('amount_cents').notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paymentMethod: varchar('payment_method', { length: 64 }),
  reference: varchar('reference', { length: 255 }),
  status: apStatusEnum('status').default('pending').notNull(),
  notes: text('notes'),
  cancelReason: text('cancel_reason'),
  cancelledBy: integer('cancelled_by'),
  createdBy: integer('created_by'),
  // F35: rastreamento da origem do lançamento (ex: 'purchase_order')
  referenceId: integer('reference_id'),
  referenceType: varchar('reference_type', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ap_tenant_idx').on(table.tenantId),
  index('ap_status_idx').on(table.status),
  index('ap_due_date_idx').on(table.dueDate),
  index('ap_reference_idx').on(table.referenceType, table.referenceId),
]);

export const cashbookEntries = pgTable('cashbook_entries', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  type: cashbookEntryTypeEnum('type').notNull(),
  amountCents: integer('amount_cents').notNull(),
  description: varchar('description', { length: 512 }).notNull(),
  category: varchar('category', { length: 128 }),
  arId: integer('ar_id'),
  apId: integer('ap_id'),
  jobId: integer('job_id'),
  clientId: integer('client_id'),
  referenceDate: timestamp('reference_date', { withTimezone: true }).notNull(),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('cashbook_tenant_idx').on(table.tenantId),
  index('cashbook_date_idx').on(table.tenantId, table.referenceDate),
  index('cashbook_type_idx').on(table.type),
]);
