import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  boolean,
  numeric,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tenants } from './tenants';

export const aiSessionStatusEnum = pgEnum('ai_session_status', ['active', 'archived']);
export const aiMessageRoleEnum = pgEnum('ai_message_role', ['user', 'assistant', 'system']);
export const aiCommandChannelEnum = pgEnum('ai_command_channel', ['text', 'voice']);
export const aiCommandRiskLevelEnum = pgEnum('ai_command_risk_level', [
  'read_only',
  'assistive',
  'transactional',
  'critical',
]);
export const aiCommandExecutionStatusEnum = pgEnum('ai_command_execution_status', [
  'pending',
  'awaiting_confirmation',
  'executing',
  'success',
  'error',
  'cancelled',
]);

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

export const aiCommandRuns = pgTable('ai_command_runs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  userId: integer('user_id').notNull().references(() => users.id),
  sessionId: integer('session_id').references(() => aiSessions.id),

  channel: aiCommandChannelEnum('channel').notNull().default('text'),
  rawInput: text('raw_input').notNull(),
  normalizedInput: text('normalized_input'),

  intent: varchar('intent', { length: 64 }),
  confidence: numeric('confidence', { precision: 4, scale: 3 }),
  entitiesJson: jsonb('entities_json')
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  missingFields: jsonb('missing_fields')
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),

  riskLevel: aiCommandRiskLevelEnum('risk_level'),
  requiresConfirmation: boolean('requires_confirmation').notNull().default(false),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  confirmedBy: integer('confirmed_by').references(() => users.id),

  toolName: varchar('tool_name', { length: 64 }),
  toolInputJson: jsonb('tool_input_json').$type<Record<string, unknown>>(),
  toolOutputJson: jsonb('tool_output_json').$type<Record<string, unknown>>(),
  executionStatus: aiCommandExecutionStatusEnum('execution_status').notNull().default('pending'),
  errorCode: varchar('error_code', { length: 32 }),
  errorMessage: text('error_message'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  executedAt: timestamp('executed_at', { withTimezone: true }),
}, (table) => [
  index('ai_command_runs_tenant_idx').on(table.tenantId),
  index('ai_command_runs_session_idx').on(table.sessionId),
  index('ai_command_runs_intent_idx').on(table.intent),
  index('ai_command_runs_status_idx').on(table.executionStatus),
]);
