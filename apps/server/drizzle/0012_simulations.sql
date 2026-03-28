DO $$ BEGIN
 CREATE TYPE "public"."simulation_status" AS ENUM('draft', 'sent', 'approved', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "simulations" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "client_id" integer NOT NULL,
  "pricing_table_id" integer,
  "status" "simulation_status" DEFAULT 'draft' NOT NULL,
  "title" varchar(255),
  "notes" text,
  "client_adjustment_percent" varchar(16) DEFAULT '0' NOT NULL,
  "scenario_discount_percent" varchar(16) DEFAULT '0' NOT NULL,
  "subtotal_cents" integer DEFAULT 0 NOT NULL,
  "adjusted_subtotal_cents" integer DEFAULT 0 NOT NULL,
  "total_cents" integer DEFAULT 0 NOT NULL,
  "estimated_cost_cents" integer DEFAULT 0 NOT NULL,
  "estimated_margin_cents" integer DEFAULT 0 NOT NULL,
  "converted_job_id" integer,
  "sent_at" timestamp with time zone,
  "approved_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "created_by" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "simulation_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "simulation_id" integer NOT NULL,
  "price_item_id" integer,
  "service_name_snapshot" varchar(255) NOT NULL,
  "category_snapshot" varchar(128),
  "unit_price_cents_snapshot" integer NOT NULL,
  "estimated_unit_cost_cents_snapshot" integer DEFAULT 0 NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "line_subtotal_cents" integer NOT NULL,
  "line_total_cents" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "simulations_tenant_idx" ON "simulations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "simulations_client_idx" ON "simulations" ("client_id");
CREATE INDEX IF NOT EXISTS "simulations_status_idx" ON "simulations" ("status");
CREATE INDEX IF NOT EXISTS "simulations_converted_job_idx" ON "simulations" ("converted_job_id");

CREATE INDEX IF NOT EXISTS "simulation_items_tenant_idx" ON "simulation_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "simulation_items_simulation_idx" ON "simulation_items" ("simulation_id");
CREATE INDEX IF NOT EXISTS "simulation_items_price_item_idx" ON "simulation_items" ("price_item_id");
