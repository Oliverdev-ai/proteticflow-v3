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
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@proteticflow/shared';

// Enums
export const clientStatusEnum = pgEnum('client_status', ['active', 'inactive']);

// Tables
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  clinic: varchar('clinic', { length: 255 }),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 32 }),
  city: varchar('city', { length: 128 }),
  state: varchar('state', { length: 2 }),
  status: clientStatusEnum('status').default('active').notNull(),
  totalJobs: integer('total_jobs').default(0).notNull(),
  totalRevenue: numeric('total_revenue', { precision: 12, scale: 2 }).default('0').notNull(),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('clients_tenant_idx').on(table.tenantId),
]);

export const orderBlocks = pgTable('order_blocks', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  clientId: integer('client_id').notNull(),
  blockStart: integer('block_start').notNull(),
  blockEnd: integer('block_end').notNull(),
  description: varchar('description', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('order_blocks_tenant_idx').on(table.tenantId),
  index('order_blocks_client_idx').on(table.clientId),
  index('order_blocks_start_idx').on(table.blockStart),
]);

export const clientPortalTokens = pgTable('client_portal_tokens', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 64 }).notNull().unique(),
  label: varchar('label', { length: 128 }).default('Acesso padrao'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastAccessAt: timestamp('last_access_at', { withTimezone: true }),
  accessCount: integer('access_count').notNull().default(0),
}, (table) => [
  index('cpt_token_idx').on(table.token),
  index('cpt_tenant_idx').on(table.tenantId),
  index('cpt_client_idx').on(table.clientId),
  index('cpt_active_idx').on(table.isActive),
]);

export const priceItems = pgTable('price_items', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 128 }).notNull(),
  material: varchar('material', { length: 255 }),
  estimatedDays: integer('estimated_days').default(5).notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('price_items_tenant_idx').on(table.tenantId),
]);
