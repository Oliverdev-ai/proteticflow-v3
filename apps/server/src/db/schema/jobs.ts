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
import { softDeleteColumns } from '@proteticflow/shared';

// Enums
// Alinhado ao PRD 04.03: pending→in_progress→quality_check→ready→delivered + cancelled
// 'overdue' é estado derivado (deadline < now), não armazenado no banco
export const jobStatusEnum = pgEnum('job_status', [
  'pending',
  'in_progress',
  'quality_check',
  'ready',
  'delivered',
  'cancelled',
]);

// Tables
export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  code: varchar('code', { length: 32 }).notNull(),
  orderNumber: integer('order_number'),
  clientId: integer('client_id').notNull(),
  serviceName: varchar('service_name', { length: 255 }).notNull(),
  patientName: varchar('patient_name', { length: 255 }),
  tooth: varchar('tooth', { length: 32 }),
  status: jobStatusEnum('status').default('pending').notNull(),
  progress: integer('progress').default(0).notNull(),
  // AP-02: totalCents é soma denormalizada dos job_items (atualizada via trigger/app)
  totalCents: integer('total_cents').notNull().default(0),
  deadline: timestamp('deadline', { withTimezone: true }).notNull(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  notes: text('notes'),
  assignedTo: integer('assigned_to'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('jobs_tenant_idx').on(table.tenantId),
  index('jobs_tenant_code_idx').on(table.tenantId, table.code),
  index('jobs_order_number_idx').on(table.orderNumber),
  index('jobs_client_idx').on(table.clientId),
  index('jobs_assigned_to_idx').on(table.assignedTo),
]);

// AP-02: Itens da OS com preço congelado no momento do pedido.
// unitPriceCents é snapshot de priceItems.priceCents — imune a reajustes futuros.
export const jobItems = pgTable('job_items', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  jobId: integer('job_id').notNull(),
  // FK nullable: null = item avulso sem catálogo
  priceItemId: integer('price_item_id'),
  // Snapshot do nome no momento da OS (imune a renomeação futura)
  serviceNameSnapshot: varchar('service_name_snapshot', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  // Preço unitário congelado no momento da criação (em centavos)
  unitPriceCents: integer('unit_price_cents').notNull(),
  // Percentual de ajuste: -10.00 = desconto 10%, +5.00 = acréscimo 5%
  adjustmentPercent: numeric('adjustment_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  // totalCents = quantity * unitPriceCents * (1 + adjustmentPercent / 100) — arredondado
  totalCents: integer('total_cents').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('job_items_tenant_idx').on(table.tenantId),
  index('job_items_job_idx').on(table.jobId),
  index('job_items_price_item_idx').on(table.priceItemId),
]);

export const jobLogs = pgTable('job_logs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  jobId: integer('job_id').notNull(),
  userId: integer('user_id'),
  userName: varchar('user_name', { length: 255 }),
  fromStatus: varchar('from_status', { length: 64 }),
  toStatus: varchar('to_status', { length: 64 }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('job_logs_tenant_idx').on(table.tenantId),
  index('job_logs_job_idx').on(table.jobId),
  index('job_logs_created_at_idx').on(table.createdAt),
]);
