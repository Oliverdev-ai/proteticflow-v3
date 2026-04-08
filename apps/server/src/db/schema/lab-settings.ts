import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const smtpModeEnum = pgEnum('smtp_mode', ['resend_fallback', 'custom_smtp']);

export const labSettings = pgTable('lab_settings', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().unique(),
  // Legacy identity fields kept for backward compatibility (source of truth is tenants)
  labName: varchar('lab_name', { length: 256 }).notNull().default('Laboratorio de Protese'),
  cnpj: varchar('cnpj', { length: 18 }),
  phone: varchar('phone', { length: 32 }),
  email: varchar('email', { length: 320 }),
  address: text('address'),
  city: varchar('city', { length: 128 }),
  state: varchar('state', { length: 2 }),
  zipCode: varchar('zip_code', { length: 10 }),
  logoUrl: text('logo_url'),
  reportHeader: text('report_header'),
  reportFooter: text('report_footer'),
  primaryColor: varchar('primary_color', { length: 7 }).default('#1a56db').notNull(),
  secondaryColor: varchar('secondary_color', { length: 7 }).default('#6b7280').notNull(),
  website: varchar('website', { length: 255 }),
  printerHost: varchar('printer_host', { length: 255 }),
  printerPort: integer('printer_port'),
  smtpMode: smtpModeEnum('smtp_mode').default('resend_fallback').notNull(),
  smtpHost: varchar('smtp_host', { length: 255 }),
  smtpPort: integer('smtp_port'),
  smtpSecure: boolean('smtp_secure').notNull().default(false),
  smtpUsername: varchar('smtp_username', { length: 255 }),
  smtpPasswordEncrypted: text('smtp_password_encrypted'),
  smtpFromName: varchar('smtp_from_name', { length: 255 }),
  smtpFromEmail: varchar('smtp_from_email', { length: 320 }),
  lastSmtpTestAt: timestamp('last_smtp_test_at', { withTimezone: true }),
  lastSmtpTestStatus: varchar('last_smtp_test_status', { length: 16 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('lab_settings_tenant_idx').on(table.tenantId),
]);
