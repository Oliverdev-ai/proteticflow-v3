DO $$ BEGIN
 CREATE TYPE "stripe_event_status" AS ENUM('pending', 'processed', 'failed', 'ignored');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "stripe_events" (
 "id" serial PRIMARY KEY NOT NULL,
 "stripe_event_id" varchar(128) NOT NULL,
 "event_type" varchar(128) NOT NULL,
 "status" "stripe_event_status" DEFAULT 'pending' NOT NULL,
 "payload" text NOT NULL,
 "processed_at" timestamp with time zone,
 "error_message" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "stripe_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);

CREATE TABLE IF NOT EXISTS "stripe_customers" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "stripe_customer_id" varchar(64) NOT NULL,
 "stripe_subscription_id" varchar(64),
 "stripe_price_id" varchar(64),
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "stripe_customers_tenant_id_unique" UNIQUE("tenant_id"),
 CONSTRAINT "stripe_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);

CREATE TABLE IF NOT EXISTS "license_checks" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "user_id" integer,
 "feature" varchar(64) NOT NULL,
 "allowed" boolean NOT NULL,
 "plan_at_check" varchar(32) NOT NULL,
 "limit_at_check" integer,
 "current_usage_at_check" integer,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "feature_usage_logs" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "feature" varchar(64) NOT NULL,
 "action" varchar(64) NOT NULL,
 "user_id" integer,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "stripe_customers"
 ADD CONSTRAINT "stripe_customers_tenant_id_tenants_id_fk"
 FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "license_checks"
 ADD CONSTRAINT "license_checks_tenant_id_tenants_id_fk"
 FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "license_checks"
 ADD CONSTRAINT "license_checks_user_id_users_id_fk"
 FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "feature_usage_logs"
 ADD CONSTRAINT "feature_usage_logs_tenant_id_tenants_id_fk"
 FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "feature_usage_logs"
 ADD CONSTRAINT "feature_usage_logs_user_id_users_id_fk"
 FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "stripe_events_event_id_idx" ON "stripe_events" ("stripe_event_id");
CREATE INDEX IF NOT EXISTS "stripe_events_status_idx" ON "stripe_events" ("status");
CREATE INDEX IF NOT EXISTS "stripe_customers_tenant_idx" ON "stripe_customers" ("tenant_id");
CREATE INDEX IF NOT EXISTS "license_checks_tenant_idx" ON "license_checks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "license_checks_feature_idx" ON "license_checks" ("feature");
CREATE INDEX IF NOT EXISTS "feature_usage_tenant_idx" ON "feature_usage_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "feature_usage_feature_idx" ON "feature_usage_logs" ("feature");
