CREATE TABLE IF NOT EXISTS "timesheets" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "employee_id" integer NOT NULL,
  "date" date NOT NULL,
  "clock_in" time,
  "clock_out" time,
  "hours_worked" numeric(5, 2),
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "timesheets"
    ADD CONSTRAINT "timesheets_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "timesheets"
    ADD CONSTRAINT "timesheets_employee_id_employees_id_fk"
    FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "timesheets_tenant_idx" ON "timesheets" ("tenant_id");
CREATE INDEX IF NOT EXISTS "timesheets_employee_idx" ON "timesheets" ("employee_id");
CREATE INDEX IF NOT EXISTS "timesheets_date_idx" ON "timesheets" ("date");
CREATE UNIQUE INDEX IF NOT EXISTS "timesheets_tenant_employee_date_uq"
  ON "timesheets" ("tenant_id", "employee_id", "date");
