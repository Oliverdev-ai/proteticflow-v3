import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { clients } from './clients';

export const portalTokens = pgTable('portal_tokens', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  lastAccessAt: timestamp('last_access_at', { withTimezone: true }),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('portal_tokens_tenant_idx').on(table.tenantId),
  index('portal_tokens_client_idx').on(table.clientId),
  index('portal_tokens_expires_idx').on(table.expiresAt),
]);
