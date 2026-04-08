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

// ─── Módulo 08: Roteiro de Entregas ───────────────────────────────────────────

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'scheduled', 'in_transit', 'delivered', 'failed',
]);

export const deliverySchedules = pgTable('delivery_schedules', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  driverName: varchar('driver_name', { length: 255 }),
  vehicle: varchar('vehicle', { length: 128 }),
  notes: text('notes'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ds_tenant_idx').on(table.tenantId),
  index('ds_date_idx').on(table.tenantId, table.date),
]);

export const deliveryItems = pgTable('delivery_items', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  scheduleId: integer('schedule_id').notNull(),
  jobId: integer('job_id').notNull(),
  clientId: integer('client_id').notNull(),
  status: deliveryStatusEnum('status').default('scheduled').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  failedReason: text('failed_reason'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('di_tenant_idx').on(table.tenantId),
  index('di_schedule_idx').on(table.scheduleId),
  index('di_job_idx').on(table.jobId),
  index('di_client_idx').on(table.clientId),
]);
