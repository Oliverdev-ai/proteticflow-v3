import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { tenants } from './tenants';

export const aiSessionStatusEnum = pgEnum('ai_session_status', ['active', 'archived']);
export const aiMessageRoleEnum = pgEnum('ai_message_role', ['user', 'assistant', 'system']);

export const aiSessions = pgTable('ai_sessions', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  userId: integer('user_id').notNull().references(() => users.id),
  title: varchar('title', { length: 255 }),
  status: aiSessionStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_sessions_tenant_idx').on(table.tenantId),
  index('ai_sessions_user_idx').on(table.userId),
  index('ai_sessions_updated_idx').on(table.updatedAt),
]);

export const aiMessages = pgTable('ai_messages', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  sessionId: integer('session_id').notNull().references(() => aiSessions.id),
  role: aiMessageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  commandDetected: varchar('command_detected', { length: 64 }),
  tokensUsed: integer('tokens_used'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ai_messages_session_idx').on(table.sessionId),
  index('ai_messages_tenant_idx').on(table.tenantId),
]);
