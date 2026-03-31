import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  pgEnum,
  numeric,
  index,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { clients } from './clients';
import { accountsReceivable } from './financials';

export const boletoStatusEnum = pgEnum('boleto_status', [
  'pending',
  'paid',
  'overdue',
  'cancelled',
  'refunded',
]);

export const boletos = pgTable('boletos', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  arId: integer('ar_id').references(() => accountsReceivable.id),
  clientId: integer('client_id').notNull().references(() => clients.id),
  gatewayId: varchar('gateway_id', { length: 128 }),
  nossoNumero: varchar('nosso_numero', { length: 64 }),
  barcode: varchar('barcode', { length: 64 }),
  pixCopyPaste: text('pix_copy_paste'),
  pdfUrl: varchar('pdf_url', { length: 512 }),
  status: boletoStatusEnum('status').default('pending').notNull(),
  amountCents: integer('amount_cents').notNull(),
  dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paidAmountCents: integer('paid_amount_cents'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  gatewayPayload: text('gateway_payload'),
  gatewayResponse: text('gateway_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('boletos_tenant_idx').on(table.tenantId),
  index('boletos_ar_idx').on(table.arId),
  index('boletos_client_idx').on(table.clientId),
  index('boletos_gateway_idx').on(table.gatewayId),
  index('boletos_status_idx').on(table.status),
]);

export const nfseStatusEnum = pgEnum('nfse_status', [
  'draft',
  'pending',
  'issued',
  'cancelled',
  'error',
]);

export const nfseList = pgTable('nfse', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  clientId: integer('client_id').notNull().references(() => clients.id),
  arId: integer('ar_id').references(() => accountsReceivable.id),
  closingId: integer('closing_id'),
  gatewayId: varchar('gateway_id', { length: 128 }),
  nfseNumber: varchar('nfse_number', { length: 32 }),
  verificationCode: varchar('verification_code', { length: 64 }),
  danfseUrl: varchar('danfse_url', { length: 512 }),
  xmlUrl: varchar('xml_url', { length: 512 }),
  status: nfseStatusEnum('status').default('draft').notNull(),
  serviceName: varchar('service_name', { length: 255 }).notNull(),
  serviceCode: varchar('service_code', { length: 16 }).notNull(),
  issqnRatePercent: numeric('issqn_rate_percent', { precision: 5, scale: 2 }).notNull(),
  grossValueCents: integer('gross_value_cents').notNull(),
  issqnCents: integer('issqn_cents').notNull(),
  netValueCents: integer('net_value_cents').notNull(),
  tomadorName: varchar('tomador_name', { length: 255 }).notNull(),
  tomadorCpfCnpj: varchar('tomador_cpf_cnpj', { length: 18 }),
  tomadorEmail: varchar('tomador_email', { length: 320 }),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  errorMessage: text('error_message'),
  gatewayPayload: text('gateway_payload'),
  gatewayResponse: text('gateway_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('nfse_tenant_idx').on(table.tenantId),
  index('nfse_client_idx').on(table.clientId),
  index('nfse_status_idx').on(table.status),
  index('nfse_gateway_idx').on(table.gatewayId),
  index('nfse_number_idx').on(table.tenantId, table.nfseNumber),
]);

export const fiscalSettings = pgTable('fiscal_settings', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id).unique(),
  municipalRegistration: varchar('municipal_registration', { length: 32 }),
  taxRegime: varchar('tax_regime', { length: 32 }),
  defaultServiceCode: varchar('default_service_code', { length: 16 }),
  defaultServiceName: varchar('default_service_name', { length: 255 }),
  issqnRatePercent: numeric('issqn_rate_percent', { precision: 5, scale: 2 }),
  asaasApiKey: varchar('asaas_api_key', { length: 128 }),
  asaasSandbox: integer('asaas_sandbox').default(1).notNull(),
  focusApiToken: varchar('focus_api_token', { length: 128 }),
  focusSandbox: integer('focus_sandbox').default(1).notNull(),
  cityCode: varchar('city_code', { length: 16 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('fiscal_settings_tenant_idx').on(table.tenantId),
]);
