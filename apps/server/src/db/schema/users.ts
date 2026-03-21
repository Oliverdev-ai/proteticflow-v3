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
  jsonb,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

// Enums
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

// Tables
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  phone: varchar('phone', { length: 32 }),
  avatarUrl: text('avatar_url'),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  twoFactorSecret: varchar('two_factor_secret', { length: 128 }),
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  role: userRoleEnum('role').default('user').notNull(),
  activeTenantId: integer('active_tenant_id'),
  isActive: boolean('is_active').default(true).notNull(),
  lastSignedIn: timestamp('last_signed_in', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(), // sha256 hash
  userAgent: varchar('user_agent', { length: 512 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('rt_user_idx').on(table.userId),
  index('rt_token_hash_idx').on(table.tokenHash),
]);

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── API Keys (01.14) ───────────────────────────────────────
// Prefixo ptf_, hash bcrypt (nunca plaintext), exibida uma única vez na criação.
// Disponível apenas nos planos Pro e Enterprise (enforcement na Fase 23).
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  createdBy: integer('created_by').notNull(), // FK → users.id (Fase 2)
  name: varchar('name', { length: 100 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(), // bcrypt hash, NUNCA plaintext
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(), // ex: ptf_live_xxxx (exibição)
  // Permissões configuráveis: null = acesso total ao tenant
  permissions: jsonb('permissions').$type<string[]>(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: integer('revoked_by'), // FK → users.id (Fase 2)
}, (table) => [
  index('api_keys_tenant_idx').on(table.tenantId),
  index('api_keys_prefix_idx').on(table.keyPrefix),
]);

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

export const deadlineNotifLog = pgTable('deadline_notif_log', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').notNull(),
  notifiedAt: timestamp('notified_at', { withTimezone: true }).defaultNow().notNull(),
});

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: varchar('auth', { length: 128 }).notNull(),
  userAgent: varchar('user_agent', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (table) => [
  index('ps_user_idx').on(table.userId),
]);
