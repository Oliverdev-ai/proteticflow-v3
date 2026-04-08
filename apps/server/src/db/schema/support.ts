import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { users } from './users';
import { clients } from './clients';
import { portalTokens } from './portal';

export const chatbotConversationStatusEnum = pgEnum('chatbot_conversation_status', [
  'open',
  'escalated',
  'resolved',
  'closed',
]);

export const chatbotConversationTypeEnum = pgEnum('chatbot_conversation_type', [
  'status_query',
  'scheduling',
  'quote',
  'technical_support',
  'general',
  'complaint',
]);

export const chatbotConversations = pgTable('chatbot_conversations', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  clientId: integer('client_id').references(() => clients.id),
  portalTokenId: integer('portal_token_id').references(() => portalTokens.id),
  type: chatbotConversationTypeEnum('type').default('general').notNull(),
  status: chatbotConversationStatusEnum('status').default('open').notNull(),
  satisfactionScore: integer('satisfaction_score'),
  escalatedToUserId: integer('escalated_to_user_id').references(() => users.id),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('chatbot_conv_tenant_idx').on(table.tenantId),
  index('chatbot_conv_client_idx').on(table.clientId),
  index('chatbot_conv_status_idx').on(table.status),
]);

export const chatbotMessageRoleEnum = pgEnum('chatbot_message_role', [
  'user',
  'assistant',
  'system',
]);

export const chatbotMessages = pgTable('chatbot_messages', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  conversationId: integer('conversation_id').notNull().references(() => chatbotConversations.id, { onDelete: 'cascade' }),
  role: chatbotMessageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  intentDetected: varchar('intent_detected', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('chatbot_msg_conversation_idx').on(table.conversationId),
  index('chatbot_msg_tenant_idx').on(table.tenantId),
]);

export const autoResponseTemplates = pgTable('auto_response_templates', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  intent: varchar('intent', { length: 64 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  isActive: integer('is_active').default(1).notNull(),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('templates_tenant_intent_idx').on(table.tenantId, table.intent),
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'in_progress',
  'resolved',
  'closed',
]);

export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  clientId: integer('client_id').references(() => clients.id),
  conversationId: integer('conversation_id').references(() => chatbotConversations.id),
  assignedToUserId: integer('assigned_to_user_id').references(() => users.id),
  priority: ticketPriorityEnum('priority').default('medium').notNull(),
  status: ticketStatusEnum('status').default('open').notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  description: text('description').notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('tickets_tenant_idx').on(table.tenantId),
  index('tickets_status_idx').on(table.status),
  index('tickets_priority_idx').on(table.priority),
  index('tickets_assigned_idx').on(table.assignedToUserId),
]);

export const ticketMessages = pgTable('ticket_messages', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  ticketId: integer('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  authorId: integer('author_id').references(() => users.id),
  content: text('content').notNull(),
  isInternal: integer('is_internal').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ticket_msg_ticket_idx').on(table.ticketId),
  index('ticket_msg_tenant_idx').on(table.tenantId),
]);
