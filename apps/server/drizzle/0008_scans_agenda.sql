-- Custom SQL migration file for scans + agenda
DO $$ BEGIN
 CREATE TYPE "scanner_type" AS ENUM('itero', 'medit', '3shape', 'carestream', 'outro');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "scan_print_status" AS ENUM('waiting', 'sent', 'printing', 'completed', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "event_type" AS ENUM('prova', 'entrega', 'retirada', 'reuniao', 'manutencao', 'outro');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "recurrence_type" AS ENUM('none', 'daily', 'weekly', 'biweekly', 'monthly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "scans" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"job_id" integer,
	"client_id" integer,
	"scanner_type" "scanner_type" DEFAULT 'outro' NOT NULL,
	"stl_upper_url" text,
	"stl_lower_url" text,
	"xml_url" text,
	"gallery_image_url" text,
	"parsed_order_id" varchar(128),
	"parsed_dentist" varchar(255),
	"parsed_cro" varchar(20),
	"parsed_patient" varchar(255),
	"parsed_procedure" varchar(255),
	"parsed_date" timestamp with time zone,
	"parsed_deadline" timestamp with time zone,
	"parsed_address" text,
	"parsed_notes" text,
	"raw_metadata_json" text,
	"print_status" "scan_print_status" DEFAULT 'waiting' NOT NULL,
	"printer_ip" varchar(45),
	"print_sent_at" timestamp with time zone,
	"print_completed_at" timestamp with time zone,
	"print_error" text,
	"notes" text,
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);

CREATE TABLE IF NOT EXISTS "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" "event_type" DEFAULT 'outro' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"job_id" integer,
	"client_id" integer,
	"employee_id" integer,
	"recurrence" "recurrence_type" DEFAULT 'none' NOT NULL,
	"recurrence_end_date" timestamp with time zone,
	"parent_event_id" integer,
	"reminder_minutes_before" integer DEFAULT 60,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"color" varchar(7),
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "scans_tenant_idx" ON "scans" ("tenant_id");
CREATE INDEX IF NOT EXISTS "scans_job_idx" ON "scans" ("job_id");
CREATE INDEX IF NOT EXISTS "scans_client_idx" ON "scans" ("client_id");
CREATE INDEX IF NOT EXISTS "scans_print_status_idx" ON "scans" ("print_status");

CREATE INDEX IF NOT EXISTS "events_tenant_idx" ON "events" ("tenant_id");
CREATE INDEX IF NOT EXISTS "events_start_idx" ON "events" ("tenant_id", "start_at");
CREATE INDEX IF NOT EXISTS "events_job_idx" ON "events" ("job_id");
CREATE INDEX IF NOT EXISTS "events_client_idx" ON "events" ("client_id");
CREATE INDEX IF NOT EXISTS "events_employee_idx" ON "events" ("employee_id");

