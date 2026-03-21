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
export const notifTypeEnum = pgEnum('notif_type', ['info', 'warning', 'danger', 'success']);
export const chatRoleEnum = pgEnum('chat_role', ['user', 'assistant']);

// Tables
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  userId: integer('user_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: notifTypeEnum('type').default('info').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  relatedJobId: integer('related_job_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('notif_tenant_user_idx').on(table.tenantId, table.userId),
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
