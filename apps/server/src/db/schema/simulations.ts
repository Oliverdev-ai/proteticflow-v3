import {
  pgEnum,
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const simulationStatusEnum = pgEnum('simulation_status', [
  'draft',
  'sent',
  'approved',
  'rejected',
]);

export const simulations = pgTable('simulations', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  clientId: integer('client_id').notNull(),
  pricingTableId: integer('pricing_table_id'),
  status: simulationStatusEnum('status').notNull().default('draft'),
  title: varchar('title', { length: 255 }),
  notes: text('notes'),
  clientAdjustmentPercent: varchar('client_adjustment_percent', { length: 16 }).notNull().default('0'),
  scenarioDiscountPercent: varchar('scenario_discount_percent', { length: 16 }).notNull().default('0'),
  subtotalCents: integer('subtotal_cents').notNull().default(0),
  adjustedSubtotalCents: integer('adjusted_subtotal_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull().default(0),
  estimatedCostCents: integer('estimated_cost_cents').notNull().default(0),
  estimatedMarginCents: integer('estimated_margin_cents').notNull().default(0),
  convertedJobId: integer('converted_job_id'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('simulations_tenant_idx').on(table.tenantId),
  index('simulations_client_idx').on(table.clientId),
  index('simulations_status_idx').on(table.status),
  index('simulations_converted_job_idx').on(table.convertedJobId),
]);

export const simulationItems = pgTable('simulation_items', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  simulationId: integer('simulation_id').notNull(),
  priceItemId: integer('price_item_id'),
  serviceNameSnapshot: varchar('service_name_snapshot', { length: 255 }).notNull(),
  categorySnapshot: varchar('category_snapshot', { length: 128 }),
  unitPriceCentsSnapshot: integer('unit_price_cents_snapshot').notNull(),
  estimatedUnitCostCentsSnapshot: integer('estimated_unit_cost_cents_snapshot').notNull().default(0),
  quantity: integer('quantity').notNull().default(1),
  lineSubtotalCents: integer('line_subtotal_cents').notNull(),
  lineTotalCents: integer('line_total_cents').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('simulation_items_tenant_idx').on(table.tenantId),
  index('simulation_items_simulation_idx').on(table.simulationId),
  index('simulation_items_price_item_idx').on(table.priceItemId),
]);
