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
  unit: varchar('unit', { length: 32 }).notNull().default('un'),
  currentStock: numeric('current_stock', { precision: 10, scale: 3 }).default('0').notNull(),
  minStock: numeric('min_stock', { precision: 10, scale: 3 }).default('0').notNull(),
  maxStock: numeric('max_stock', { precision: 10, scale: 3 }),
  costPrice: numeric('cost_price', { precision: 10, scale: 2 }).default('0').notNull(),
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
  invoiceNumber: varchar('invoice_number', { length: 128 }),
  unitCost: numeric('unit_cost', { precision: 10, scale: 2 }),
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
