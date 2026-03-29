import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  pgEnum,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const stripeEventStatusEnum = pgEnum('stripe_event_status', [
  'pending',
  'processed',
  'failed',
  'ignored',
]);

export const stripeEvents = pgTable('stripe_events', {
  id: serial('id').primaryKey(),
  stripeEventId: varchar('stripe_event_id', { length: 128 }).notNull().unique(),
  eventType: varchar('event_type', { length: 128 }).notNull(),
  status: stripeEventStatusEnum('status').default('pending').notNull(),
  payload: text('payload').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('stripe_events_event_id_idx').on(table.stripeEventId),
  index('stripe_events_status_idx').on(table.status),
]);

export const stripeCustomers = pgTable('stripe_customers', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id).unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 64 }).notNull().unique(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 64 }),
  stripePriceId: varchar('stripe_price_id', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('stripe_customers_tenant_idx').on(table.tenantId),
]);

export const licenseChecks = pgTable('license_checks', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  userId: integer('user_id').references(() => users.id),
  feature: varchar('feature', { length: 64 }).notNull(),
  allowed: boolean('allowed').notNull(),
  planAtCheck: varchar('plan_at_check', { length: 32 }).notNull(),
  limitAtCheck: integer('limit_at_check'),
  currentUsageAtCheck: integer('current_usage_at_check'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('license_checks_tenant_idx').on(table.tenantId),
  index('license_checks_feature_idx').on(table.feature),
]);

export const featureUsageLogs = pgTable('feature_usage_logs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  feature: varchar('feature', { length: 64 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('feature_usage_tenant_idx').on(table.tenantId),
  index('feature_usage_feature_idx').on(table.feature),
]);
