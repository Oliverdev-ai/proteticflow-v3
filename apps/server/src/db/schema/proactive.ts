import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  boolean,
  time,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants.js';
import { users } from './users.js';

export type UserChannelsConfig = {
  push: boolean;
  email: boolean;
  whatsapp: boolean;
  in_app: boolean;
  inApp?: boolean;
  mutedUntilByType?: Record<string, string>;
};

export const alertLog = pgTable('alert_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id),
  alertType: text('alert_type').notNull(),
  entityType: text('entity_type'),
  entityId: integer('entity_id'),
  dedupKey: text('dedup_key').notNull(),
  channel: text('channel').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
  payload: jsonb('payload').$type<Record<string, unknown> | null>(),
}, (table) => [
  uniqueIndex('alert_log_dedup_uniq').on(table.tenantId, table.dedupKey),
  index('alert_log_tenant_type_idx').on(table.tenantId, table.alertType, table.sentAt),
]);

export const userPreferences = pgTable('user_preferences', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  briefingEnabled: boolean('briefing_enabled').notNull().default(true),
  briefingTime: time('briefing_time', { withTimezone: false }).notNull().default('08:00'),
  quietHoursStart: time('quiet_hours_start', { withTimezone: false }).notNull().default('20:00'),
  quietHoursEnd: time('quiet_hours_end', { withTimezone: false }).notNull().default('07:00'),
  quietModeEnabled: boolean('quiet_mode_enabled').notNull().default(false),
  quietModeStart: text('quiet_mode_start').notNull().default('22:00'),
  quietModeEnd: text('quiet_mode_end').notNull().default('07:00'),
  channels: jsonb('channels')
    .$type<UserChannelsConfig>()
    .notNull()
    .default(sql`'{"push":true,"email":true,"whatsapp":false,"in_app":true}'::jsonb`),
  alertTypesMuted: text('alert_types_muted').array().notNull().default(sql`ARRAY[]::TEXT[]`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
