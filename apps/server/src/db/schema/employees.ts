import { pgTable, serial, varchar, integer, timestamp, boolean, text, numeric, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { softDeleteColumns } from '@proteticflow/shared';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const employeeTypeEnum = pgEnum('employee_type', [
  'protesista', 'auxiliar', 'recepcionista', 'gerente', 'proprietario', 'outro'
]);

export const contractTypeEnum = pgEnum('contract_type', [
  'clt', 'pj_mei', 'freelancer', 'estagiario', 'autonomo', 'temporario'
]);

export const payrollStatusEnum = pgEnum('payroll_status', ['open', 'closed']);

export const commissionPaymentStatusEnum = pgEnum('commission_payment_status', ['pending', 'paid']);

// ─── Tabela employees ───────────────────────────────────────────────────────

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  // 10.01 Dados pessoais
  name: varchar('name', { length: 255 }).notNull(),
  cpf: varchar('cpf', { length: 14 }),
  rg: varchar('rg', { length: 20 }),
  birthDate: timestamp('birth_date', { withTimezone: true }),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 32 }),
  phone2: varchar('phone2', { length: 32 }),
  // 10.02 Endereço completo
  street: varchar('street', { length: 255 }),
  addressNumber: varchar('address_number', { length: 20 }),
  complement: varchar('complement', { length: 128 }),
  neighborhood: varchar('neighborhood', { length: 128 }),
  city: varchar('city', { length: 128 }),
  state: varchar('state', { length: 2 }),
  zipCode: varchar('zip_code', { length: 10 }),
  // 10.03 Vínculo
  admissionDate: timestamp('admission_date', { withTimezone: true }),
  dismissalDate: timestamp('dismissal_date', { withTimezone: true }),
  position: varchar('position', { length: 128 }),
  department: varchar('department', { length: 128 }),
  // 10.04 Tipo
  type: employeeTypeEnum('type').default('auxiliar').notNull(),
  // 10.05 Contrato
  contractType: contractTypeEnum('contract_type').default('clt').notNull(),
  // 10.06 Remuneração
  baseSalaryCents: integer('base_salary_cents').notNull().default(0),
  transportAllowanceCents: integer('transport_allowance_cents').notNull().default(0),
  mealAllowanceCents: integer('meal_allowance_cents').notNull().default(0),
  healthInsuranceCents: integer('health_insurance_cents').notNull().default(0),
  // 10.07 Dados bancários
  bankName: varchar('bank_name', { length: 128 }),
  bankAgency: varchar('bank_agency', { length: 20 }),
  bankAccount: varchar('bank_account', { length: 30 }),
  // 10.08 Comissão padrão
  defaultCommissionPercent: numeric('default_commission_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  // Vínculo com user do sistema
  userId: integer('user_id'),
  // Status
  isActive: boolean('is_active').notNull().default(true),
  notes: text('notes'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ...softDeleteColumns,
}, (table) => [
  index('emp_tenant_idx').on(table.tenantId),
  index('emp_cpf_idx').on(table.tenantId, table.cpf),
  index('emp_active_idx').on(table.tenantId, table.isActive),
  index('emp_type_idx').on(table.type),
]);

// ─── Tabela employeeSkills ─────────────────────────────────────────────────

export const employeeSkills = pgTable('employee_skills', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  employeeId: integer('employee_id').notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  level: integer('level').notNull().default(1),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('es_tenant_idx').on(table.tenantId),
  index('es_employee_idx').on(table.employeeId),
]);

// ─── Tabela jobAssignments ─────────────────────────────────────────────────

export const jobAssignments = pgTable('job_assignments', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  jobId: integer('job_id').notNull(),
  employeeId: integer('employee_id').notNull(),
  task: varchar('task', { length: 255 }),
  commissionOverridePercent: numeric('commission_override_percent', { precision: 5, scale: 2 }),
  commissionAmountCents: integer('commission_amount_cents'),
  commissionCalculatedAt: timestamp('commission_calculated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('ja_tenant_idx').on(table.tenantId),
  index('ja_job_idx').on(table.jobId),
  index('ja_employee_idx').on(table.employeeId),
]);

// ─── Tabela commissionPayments ─────────────────────────────────────────────

export const commissionPayments = pgTable('commission_payments', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  employeeId: integer('employee_id').notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  totalCents: integer('total_cents').notNull(),
  paymentMethod: varchar('payment_method', { length: 64 }),
  reference: varchar('reference', { length: 255 }),
  status: commissionPaymentStatusEnum('status').default('pending').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  notes: text('notes'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('cp_tenant_idx').on(table.tenantId),
  index('cp_employee_idx').on(table.employeeId),
  index('cp_status_idx').on(table.status),
]);

// ─── Tabela payrollPeriods ─────────────────────────────────────────────────

export const payrollPeriods = pgTable('payroll_periods', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  referenceDate: timestamp('reference_date', { withTimezone: true }).notNull(),
  status: payrollStatusEnum('status').default('open').notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: integer('closed_by'),
  totalGrossCents: integer('total_gross_cents').notNull().default(0),
  totalDiscountsCents: integer('total_discounts_cents').notNull().default(0),
  totalNetCents: integer('total_net_cents').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('pp_tenant_idx').on(table.tenantId),
  uniqueIndex('pp_tenant_period_unique').on(table.tenantId, table.year, table.month),
]);

// ─── Tabela payrollEntries ─────────────────────────────────────────────────

export const payrollEntries = pgTable('payroll_entries', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  periodId: integer('period_id').notNull(),
  employeeId: integer('employee_id').notNull(),
  baseSalaryCents: integer('base_salary_cents').notNull(),
  overtimeHours: numeric('overtime_hours', { precision: 5, scale: 2 }).notNull().default('0'),
  overtimeValueCents: integer('overtime_value_cents').notNull().default(0),
  commissionsCents: integer('commissions_cents').notNull().default(0),
  bonusCents: integer('bonus_cents').notNull().default(0),
  discountsCents: integer('discounts_cents').notNull().default(0),
  grossCents: integer('gross_cents').notNull(),
  netCents: integer('net_cents').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('pe_tenant_idx').on(table.tenantId),
  index('pe_period_idx').on(table.periodId),
  index('pe_employee_idx').on(table.employeeId),
  uniqueIndex('pe_period_employee_unique').on(table.periodId, table.employeeId),
]);
