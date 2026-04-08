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
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Enums
// Alinhado ao PRD seção 1.5: trial (30 dias) → starter → pro → enterprise
export const planTierEnum = pgEnum('plan_tier', ['trial', 'starter', 'pro', 'enterprise']);
// Alinhado ao PRD seção 1.4 e packages/shared/constants/roles.ts
export const tenantMemberRoleEnum = pgEnum('tenant_member_role', [
  'superadmin', 'gerente', 'producao', 'recepcao', 'contabil',
]);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'expired']);

// Tables
export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  plan: planTierEnum('plan').default('trial').notNull(),
  planExpiresAt: timestamp('plan_expires_at', { withTimezone: true }),
  logoUrl: text('logo_url'),
  cnpj: varchar('cnpj', { length: 18 }),
  phone: varchar('phone', { length: 32 }),
  email: varchar('email', { length: 320 }),
  address: text('address'),
  city: varchar('city', { length: 128 }),
  state: varchar('state', { length: 2 }),
  isActive: boolean('is_active').default(true).notNull(),
  // PRD Fase 3: Multi-empresa — nullable self-reference FK
  parentTenantId: integer('parent_tenant_id'),
  // Contadores de uso (enforcement na Fase 23 — licensedProcedure)
  clientCount: integer('client_count').notNull().default(0),
  jobCountThisMonth: integer('job_count_this_month').notNull().default(0),
  userCount: integer('user_count').notNull().default(0),
  priceTableCount: integer('price_table_count').notNull().default(0),
  storageUsedMb: integer('storage_used_mb').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('tenants_slug_idx').on(table.slug),
  index('tenants_active_idx').on(table.isActive),
]);

export const tenantMembers = pgTable('tenant_members', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull(),
  role: tenantMemberRoleEnum('role').default('recepcao').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  blockedAt: timestamp('blocked_at', { withTimezone: true }),
  blockedReason: text('blocked_reason'),
  blockedBy: integer('blocked_by'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('tm_tenant_user_unique').on(table.tenantId, table.userId),
  index('tm_user_idx').on(table.userId),
  index('tm_tenant_idx').on(table.tenantId),
]);

export const invites = pgTable('invites', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  role: tenantMemberRoleEnum('role').default('recepcao').notNull(),
  token: varchar('token', { length: 128 }).notNull().unique(),
  status: inviteStatusEnum('status').default('pending').notNull(),
  invitedBy: integer('invited_by').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
