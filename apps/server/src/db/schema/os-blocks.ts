import { pgTable, serial, integer, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { clients } from './clients';

export const osBlocks = pgTable('os_blocks', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  clientId: integer('client_id').notNull().references(() => clients.id),
  startNumber: integer('start_number').notNull(),
  endNumber: integer('end_number').notNull(),
  label: varchar('label', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('os_blocks_tenant_range').on(table.tenantId, table.startNumber, table.endNumber),
]);
