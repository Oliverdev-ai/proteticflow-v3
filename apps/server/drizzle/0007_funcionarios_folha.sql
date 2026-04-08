-- Custom SQL migration file for employees and payroll
DO $$ BEGIN
 CREATE TYPE "employee_type" AS ENUM('protesista', 'auxiliar', 'recepcionista', 'gerente', 'proprietario', 'outro');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "contract_type" AS ENUM('clt', 'pj_mei', 'freelancer', 'estagiario', 'autonomo', 'temporario');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "payroll_status" AS ENUM('open', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "commission_payment_status" AS ENUM('pending', 'paid');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"cpf" varchar(14),
	"rg" varchar(20),
	"birth_date" timestamp with time zone,
	"email" varchar(320),
	"phone" varchar(32),
	"phone2" varchar(32),
	"street" varchar(255),
	"address_number" varchar(20),
	"complement" varchar(128),
	"neighborhood" varchar(128),
	"city" varchar(128),
	"state" varchar(2),
	"zip_code" varchar(10),
	"admission_date" timestamp with time zone,
	"dismissal_date" timestamp with time zone,
	"position" varchar(128),
	"department" varchar(128),
	"type" "employee_type" DEFAULT 'auxiliar' NOT NULL,
	"contract_type" "contract_type" DEFAULT 'clt' NOT NULL,
	"base_salary_cents" integer DEFAULT 0 NOT NULL,
	"transport_allowance_cents" integer DEFAULT 0 NOT NULL,
	"meal_allowance_cents" integer DEFAULT 0 NOT NULL,
	"health_insurance_cents" integer DEFAULT 0 NOT NULL,
	"bank_name" varchar(128),
	"bank_agency" varchar(20),
	"bank_account" varchar(30),
	"default_commission_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"user_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "employee_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "job_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"task" varchar(255),
	"commission_override_percent" numeric(5, 2),
	"commission_amount_cents" integer,
	"commission_calculated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "commission_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"total_cents" integer NOT NULL,
	"payment_method" varchar(64),
	"reference" varchar(255),
	"status" "commission_payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payroll_periods" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"reference_date" timestamp with time zone NOT NULL,
	"status" "payroll_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" integer,
	"total_gross_cents" integer DEFAULT 0 NOT NULL,
	"total_discounts_cents" integer DEFAULT 0 NOT NULL,
	"total_net_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "payroll_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"period_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"base_salary_cents" integer NOT NULL,
	"overtime_hours" numeric(5, 2) DEFAULT '0' NOT NULL,
	"overtime_value_cents" integer DEFAULT 0 NOT NULL,
	"commissions_cents" integer DEFAULT 0 NOT NULL,
	"bonus_cents" integer DEFAULT 0 NOT NULL,
	"discounts_cents" integer DEFAULT 0 NOT NULL,
	"gross_cents" integer NOT NULL,
	"net_cents" integer NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "emp_tenant_idx" ON "employees" ("tenant_id");
CREATE INDEX IF NOT EXISTS "emp_cpf_idx" ON "employees" ("tenant_id", "cpf");
CREATE INDEX IF NOT EXISTS "emp_active_idx" ON "employees" ("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "emp_type_idx" ON "employees" ("type");

CREATE INDEX IF NOT EXISTS "es_tenant_idx" ON "employee_skills" ("tenant_id");
CREATE INDEX IF NOT EXISTS "es_employee_idx" ON "employee_skills" ("employee_id");

CREATE INDEX IF NOT EXISTS "ja_tenant_idx" ON "job_assignments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ja_job_idx" ON "job_assignments" ("job_id");
CREATE INDEX IF NOT EXISTS "ja_employee_idx" ON "job_assignments" ("employee_id");

CREATE INDEX IF NOT EXISTS "cp_tenant_idx" ON "commission_payments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "cp_employee_idx" ON "commission_payments" ("employee_id");
CREATE INDEX IF NOT EXISTS "cp_status_idx" ON "commission_payments" ("status");

CREATE INDEX IF NOT EXISTS "pp_tenant_idx" ON "payroll_periods" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "pp_tenant_period_unique" ON "payroll_periods" ("tenant_id", "year", "month");

CREATE INDEX IF NOT EXISTS "pe_tenant_idx" ON "payroll_entries" ("tenant_id");
CREATE INDEX IF NOT EXISTS "pe_period_idx" ON "payroll_entries" ("period_id");
CREATE INDEX IF NOT EXISTS "pe_employee_idx" ON "payroll_entries" ("employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "pe_period_employee_unique" ON "payroll_entries" ("period_id", "employee_id");
