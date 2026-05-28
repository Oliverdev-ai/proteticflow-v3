import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './tenants';
import { clients } from './clients';
import { users } from './users';

export const whatsappProviderEnum = pgEnum('whatsapp_provider', ['mock', 'blip', 'meta']);
export const whatsappTemplateStatusEnum = pgEnum('whatsapp_template_status', [
  'pending',
  'approved',
  'rejected',
  'disabled',
]);
export const whatsappOptInStatusEnum = pgEnum('whatsapp_opt_in_status', [
  'pending',
  'opted_in',
  'opted_out',
]);
export const whatsappMessageDirectionEnum = pgEnum('whatsapp_message_direction', ['inbound', 'outbound']);
export const whatsappMessageStatusEnum = pgEnum('whatsapp_message_status', [
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
  'blocked',
  'received',
]);

export type WhatsappTenantConfig = {
  provider: 'mock' | 'blip' | 'meta';
  webhookSecret?: string;
  blip?: {
    apiToken: string;
    fromNumber: string;
    baseUrl?: string;
  };
  meta?: {
    accessToken: string;
    phoneNumberId: string;
    businessAccountId?: string;
  };
};

export const whatsappTemplates = pgTable('whatsapp_templates', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  templateName: varchar('template_name', { length: 120 }).notNull(),
  language: varchar('language', { length: 16 }).notNull().default('pt_BR'),
  category: varchar('category', { length: 32 }).notNull().default('utility'),
  status: whatsappTemplateStatusEnum('status').notNull().default('pending'),
  providerTemplateId: varchar('provider_template_id', { length: 191 }),
  rejectedReason: text('rejected_reason'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('whatsapp_templates_tenant_name_language_uniq').on(
    table.tenantId,
    table.templateName,
    table.language,
  ),
  index('whatsapp_templates_tenant_status_idx').on(table.tenantId, table.status),
]);

export const whatsappOptIns = pgTable('whatsapp_opt_ins', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
  phoneE164: text('phone_e164').notNull(),
  status: whatsappOptInStatusEnum('status').notNull().default('pending'),
  evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  source: varchar('source', { length: 64 }).notNull().default('manual'),
  keyword: text('keyword'),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
  optedInAt: timestamp('opted_in_at', { withTimezone: true }),
  optedOutAt: timestamp('opted_out_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('whatsapp_opt_ins_tenant_phone_uniq').on(table.tenantId, table.phoneE164),
  index('whatsapp_opt_ins_tenant_status_idx').on(table.tenantId, table.status),
  index('whatsapp_opt_ins_tenant_client_idx').on(table.tenantId, table.clientId),
]);

export const whatsappMessages = pgTable('whatsapp_messages', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  direction: whatsappMessageDirectionEnum('direction').notNull(),
  status: whatsappMessageStatusEnum('status').notNull().default('queued'),
  provider: whatsappProviderEnum('provider').notNull().default('mock'),
  providerMessageId: varchar('provider_message_id', { length: 191 }),
  phoneE164: text('phone_e164').notNull(),
  templateName: varchar('template_name', { length: 120 }),
  body: text('body').notNull(),
  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  statusRank: integer('status_rank').notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('whatsapp_messages_tenant_provider_msg_uniq')
    .on(table.tenantId, table.providerMessageId)
    .where(sql`${table.providerMessageId} IS NOT NULL`),
  index('whatsapp_messages_tenant_created_idx').on(table.tenantId, table.createdAt),
  index('whatsapp_messages_tenant_phone_idx').on(table.tenantId, table.phoneE164, table.createdAt),
]);
