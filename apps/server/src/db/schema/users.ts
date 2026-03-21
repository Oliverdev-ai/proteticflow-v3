import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

// Enums
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

// Tables
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 32 }),
  // JWT auth (Phase 2) — replaces legacy openId/loginMethod
  passwordHash: varchar('password_hash', { length: 255 }),
  role: userRoleEnum('role').default('user').notNull(),
  activeTenantId: integer('active_tenant_id'),
  isActive: boolean('is_active').default(true).notNull(),
  lastSignedIn: timestamp('last_signed_in', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const deadlineNotifLog = pgTable('deadline_notif_log', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').notNull(),
  notifiedAt: timestamp('notified_at', { withTimezone: true }).defaultNow().notNull(),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: varchar('auth', { length: 128 }).notNull(),
  userAgent: varchar('user_agent', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (table) => [
  index('ps_user_idx').on(table.userId),
]);
