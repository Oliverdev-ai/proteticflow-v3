import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  userId: integer('user_id').notNull(),
  action: varchar('action', { length: 128 }).notNull(),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: integer('entity_id'),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('audit_logs_tenant_idx').on(table.tenantId),
  index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  index('audit_logs_created_idx').on(table.createdAt),
  index('audit_logs_user_idx').on(table.userId),
]);
