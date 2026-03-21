import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const labSettings = pgTable('lab_settings', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().unique(),
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
  primaryColor: varchar('primary_color', { length: 7 }).default('#1a56db'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('lab_settings_tenant_idx').on(table.tenantId),
]);
