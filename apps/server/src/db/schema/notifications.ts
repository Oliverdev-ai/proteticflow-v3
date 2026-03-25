import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// Enums
export const notifTypeEnum = pgEnum('notif_type', ['info', 'warning', 'error', 'success', 'danger']);
export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant']);
export const notifChannelEnum = pgEnum('notif_channel', ['in_app', 'push', 'email']);
export const notifEventEnum = pgEnum('notif_event', [
  'invite',
  'password_reset',
  'report_ready',
  'deadline_24h',
  'ar_overdue',
]);

// Tables
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  userId: integer('user_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: notifTypeEnum('type').default('info').notNull(),
  eventKey: notifEventEnum('event_key').notNull().default('deadline_24h'),
  isRead: boolean('is_read').default(false).notNull(),
  relatedJobId: integer('related_job_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('notif_tenant_user_idx').on(table.tenantId, table.userId),
  index('notif_user_read_idx').on(table.userId, table.isRead),
]);

export const notificationPreferences = pgTable('notification_preferences', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  userId: integer('user_id').notNull(),
  eventKey: notifEventEnum('event_key').notNull(),
  inAppEnabled: boolean('in_app_enabled').notNull().default(true),
  pushEnabled: boolean('push_enabled').notNull().default(true),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('notif_pref_tenant_user_event_unique').on(table.tenantId, table.userId, table.eventKey),
  index('notif_pref_tenant_user_idx').on(table.tenantId, table.userId),
]);

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  userId: integer('user_id').notNull(),
  role: chatRoleEnum('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('chat_tenant_user_idx').on(table.tenantId, table.userId),
]);
