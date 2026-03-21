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
} from 'drizzle-orm/pg-core';

// Enums
export const planTierEnum = pgEnum('plan_tier', ['free', 'starter', 'professional', 'enterprise']);
export const tenantMemberRoleEnum = pgEnum('tenant_member_role', ['admin', 'technician', 'viewer']);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'expired']);
export const inviteRoleEnum = pgEnum('invite_role', ['user', 'admin']);

// Tables
export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 128 }).notNull().unique(),
  plan: planTierEnum('plan').default('free').notNull(),
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
  role: tenantMemberRoleEnum('role').default('technician').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('tm_tenant_user_idx').on(table.tenantId, table.userId),
  index('tm_user_idx').on(table.userId),
  index('tm_tenant_idx').on(table.tenantId),
]);

export const invites = pgTable('invites', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  role: inviteRoleEnum('role').default('user').notNull(),
  token: varchar('token', { length: 128 }).notNull().unique(),
  status: inviteStatusEnum('status').default('pending').notNull(),
  invitedBy: integer('invited_by').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
