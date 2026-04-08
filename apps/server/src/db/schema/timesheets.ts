import { date, index, integer, numeric, pgTable, serial, text, time, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { employees } from './employees';

export const timesheets = pgTable('timesheets', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull().references(() => tenants.id),
  employeeId: integer('employee_id').notNull().references(() => employees.id),
  date: date('date').notNull(),
  clockIn: time('clock_in'),
  clockOut: time('clock_out'),
  hoursWorked: numeric('hours_worked', { precision: 5, scale: 2 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('timesheets_tenant_idx').on(table.tenantId),
  index('timesheets_employee_idx').on(table.employeeId),
  index('timesheets_date_idx').on(table.date),
  uniqueIndex('timesheets_tenant_employee_date_uq').on(table.tenantId, table.employeeId, table.date),
]);
