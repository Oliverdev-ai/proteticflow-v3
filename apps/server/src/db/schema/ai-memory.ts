import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core/columns/vector_extension/vector';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const AI_MEMORY_EMBEDDING_DIMENSIONS = 768;

export type AiMemoryValue = Record<string, unknown>;

export const aiMemory = pgTable('ai_memory', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  scope: text('scope').notNull().default('user'),
  category: text('category').notNull().default('general'),
  entityType: text('entity_type'),
  entityId: integer('entity_id'),
  keyText: text('key_text').notNull(),
  valueJson: jsonb('value_json').$type<AiMemoryValue>().notNull(),
  embedding: vector('embedding', { dimensions: AI_MEMORY_EMBEDDING_DIMENSIONS }),
  source: text('source').notNull().default('flow_ia'),
  confidence: doublePrecision('confidence').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
  accessCount: integer('access_count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => [
  index('ai_memory_tenant_idx').on(table.tenantId),
  index('ai_memory_lookup_idx').on(table.tenantId, table.userId, table.category, table.entityType, table.entityId),
  index('ai_memory_expires_idx').on(table.expiresAt),
]);

export const lgpdRequests = pgTable('lgpd_requests', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  status: text('status').notNull().default('pending'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  payloadUrl: text('payload_url'),
}, (table) => [
  index('lgpd_requests_tenant_user_idx').on(table.tenantId, table.userId),
]);
