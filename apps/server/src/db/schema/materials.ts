import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  numeric,
  index,
} from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@proteticflow/shared';

// Enums
export const movementTypeEnum = pgEnum('movement_type', ['in', 'out', 'adjustment']);

// Tables
export const materialCategories = pgTable('material_categories', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 32 }).default('slate'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('mat_cat_tenant_idx').on(table.tenantId),
]);

export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  cnpj: varchar('cnpj', { length: 18 }),    // PRD 09.03
  contact: varchar('contact', { length: 255 }),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 32 }),
  address: text('address'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('suppliers_tenant_idx').on(table.tenantId),
]);

export const materials = pgTable('materials', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  categoryId: integer('category_id'),
  supplierId: integer('supplier_id'),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 64 }),         // PRD 09.01
  barcode: varchar('barcode', { length: 128 }),   // PRD 09.01
  description: text('description'),
  unit: varchar('unit', { length: 32 }).notNull().default('un'),
  currentStock: numeric('current_stock', { precision: 10, scale: 3 }).default('0').notNull(),
  minStock: numeric('min_stock', { precision: 10, scale: 3 }).default('0').notNull(),
  maxStock: numeric('max_stock', { precision: 10, scale: 3 }),
  averageCostCents: integer('average_cost_cents').notNull().default(0),   // 09.05 custo médio
  lastPurchasePriceCents: integer('last_purchase_price_cents'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('mat_tenant_idx').on(table.tenantId),
  index('mat_category_idx').on(table.categoryId),
  index('mat_supplier_idx').on(table.supplierId),
  index('mat_active_idx').on(table.isActive),
  index('mat_code_idx').on(table.code),
  index('mat_barcode_idx').on(table.barcode),
]);

export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  materialId: integer('material_id').notNull(),
  type: movementTypeEnum('type').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
  stockAfter: numeric('stock_after', { precision: 10, scale: 3 }).notNull(),
  reason: varchar('reason', { length: 512 }),
  jobId: integer('job_id'),
  supplierId: integer('supplier_id'),          // FK optional (09.04)
  purchaseOrderId: integer('purchase_order_id'), // FK optional (09.08)
  invoiceNumber: varchar('invoice_number', { length: 128 }),
  unitCostCents: integer('unit_cost_cents'),    // aligned to cents
  notes: text('notes'),
  createdBy: integer('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('sm_tenant_idx').on(table.tenantId),
  index('sm_material_idx').on(table.materialId),
  index('sm_type_idx').on(table.type),
  index('sm_created_at_idx').on(table.createdAt),
  index('sm_job_idx').on(table.jobId),
]);

// ─── Módulo 09: Ordens de Compra ─────────────────────────────────────────────

export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', [
  'draft', 'sent', 'received', 'cancelled',
]);

export const purchaseOrders = pgTable('purchase_orders', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  supplierId: integer('supplier_id'),
  code: varchar('code', { length: 32 }).notNull(),
  status: purchaseOrderStatusEnum('status').default('draft').notNull(),
  totalCents: integer('total_cents').notNull().default(0),
  notes: text('notes'),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  receivedBy: integer('received_by'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('po_tenant_idx').on(table.tenantId),
  index('po_supplier_idx').on(table.supplierId),
  index('po_status_idx').on(table.status),
]);

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  purchaseOrderId: integer('purchase_order_id').notNull(),
  materialId: integer('material_id').notNull(),
  quantity: numeric('quantity', { precision: 10, scale: 3 }).notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  totalCents: integer('total_cents').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('poi_tenant_idx').on(table.tenantId),
  index('poi_po_idx').on(table.purchaseOrderId),
  index('poi_material_idx').on(table.materialId),
]);
