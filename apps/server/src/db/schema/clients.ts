import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@proteticflow/shared';

// Enums
export const clientStatusEnum = pgEnum('client_status', ['active', 'inactive']);
export const documentTypeEnum = pgEnum('document_type', ['cpf', 'cnpj']);

// ─── Módulo 06: Tabelas de Preços ─────────────────────────────────────────────
// Agrupamento de price_items por tabela. Um tenant pode ter múltiplas tabelas
// (ex: "Tabela Clínica A", "Tabela Hospitais"). Uma é marcada como padrão.
export const pricingTables = pgTable('pricing_tables', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('pricing_tables_tenant_idx').on(table.tenantId),
  index('pricing_tables_default_idx').on(table.tenantId, table.isDefault),
  // PRD 06.01: nome único por tenant (partial — ignora soft-deleted)
  uniqueIndex('pricing_tables_tenant_name_idx').on(table.tenantId, table.name),
]);

// ─── Módulo 03: Clientes ──────────────────────────────────────────────────────
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  clinic: varchar('clinic', { length: 255 }),
  email: varchar('email', { length: 320 }),
  // Telefones
  phone: varchar('phone', { length: 32 }),
  phone2: varchar('phone2', { length: 32 }),
  // Documento fiscal (único por tenant)
  documentType: documentTypeEnum('document_type'),
  document: varchar('document', { length: 20 }),
  // Pessoa de contato (ex: responsável na clínica)
  contactPerson: varchar('contact_person', { length: 255 }),
  // Endereço detalhado (PRD 03.02)
  street: varchar('street', { length: 255 }),
  addressNumber: varchar('address_number', { length: 20 }),
  complement: varchar('complement', { length: 128 }),
  neighborhood: varchar('neighborhood', { length: 128 }),
  city: varchar('city', { length: 128 }),
  state: varchar('state', { length: 2 }),
  zipCode: varchar('zip_code', { length: 10 }),
  // Preferências técnicas (ex: especificações de materiais, processos preferidos)
  technicalPreferences: text('technical_preferences'),
  // AP-07: ajuste de preço por cliente (ex: -10.00 = desconto 10%, +5.00 = acréscimo 5%)
  priceAdjustmentPercent: numeric('price_adjustment_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  // AP-07: tabela de preços específica para este cliente (null = usa tabela padrão do tenant)
  pricingTableId: integer('pricing_table_id'),
  // Denormalizados para dashboard — atualizados pela app a cada OS criada/entregue
  status: clientStatusEnum('status').default('active').notNull(),
  totalJobs: integer('total_jobs').default(0).notNull(),
  totalRevenueCents: integer('total_revenue_cents').notNull().default(0),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('clients_tenant_idx').on(table.tenantId),
  // Documento único por tenant (quando preenchido)
  uniqueIndex('clients_tenant_document_idx').on(table.tenantId, table.document),
]);

// ─── Portal do cliente ────────────────────────────────────────────────────────
export const clientPortalTokens = pgTable('client_portal_tokens', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 64 }).notNull().unique(),
  label: varchar('label', { length: 128 }).default('Acesso padrao'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastAccessAt: timestamp('last_access_at', { withTimezone: true }),
  accessCount: integer('access_count').notNull().default(0),
}, (table) => [
  index('cpt_token_idx').on(table.token),
  index('cpt_tenant_idx').on(table.tenantId),
  index('cpt_client_idx').on(table.clientId),
  index('cpt_active_idx').on(table.isActive),
]);

// ─── Módulo 06: Itens de preço ────────────────────────────────────────────────
export const priceItems = pgTable('price_items', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  // null = item avulso (não pertence a nenhuma tabela de preços)
  pricingTableId: integer('pricing_table_id'),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 128 }).notNull(),
  material: varchar('material', { length: 255 }),
  estimatedDays: integer('estimated_days').default(5).notNull(),
  // AP-02: preço em centavos — snapshot copiado para job_items.unitPriceCents na criação da OS
  priceCents: integer('price_cents').notNull().default(0),
  // PRD 06.02: código interno do serviço (ex: "CER-001")
  code: varchar('code', { length: 64 }),
  // PRD 06.02: descrição detalhada do serviço
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('price_items_tenant_idx').on(table.tenantId),
  index('price_items_table_idx').on(table.pricingTableId),
  // PRD 06.02: nome único por tabela (partial — ignora soft-deleted e itens sem tabela)
  uniqueIndex('price_items_table_name_idx').on(table.pricingTableId, table.name),
]);
