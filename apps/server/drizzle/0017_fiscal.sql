DO $$ BEGIN
 CREATE TYPE "boleto_status" AS ENUM('pending', 'paid', 'overdue', 'cancelled', 'refunded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "nfse_status" AS ENUM('draft', 'pending', 'issued', 'cancelled', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "boletos" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "ar_id" integer,
 "client_id" integer NOT NULL,
 "gateway_id" varchar(128),
 "nosso_numero" varchar(64),
 "barcode" varchar(64),
 "pix_copy_paste" text,
 "pdf_url" varchar(512),
 "status" "boleto_status" DEFAULT 'pending' NOT NULL,
 "amount_cents" integer NOT NULL,
 "due_date" timestamp with time zone NOT NULL,
 "paid_at" timestamp with time zone,
 "paid_amount_cents" integer,
 "cancelled_at" timestamp with time zone,
 "gateway_payload" text,
 "gateway_response" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "nfse" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "client_id" integer NOT NULL,
 "ar_id" integer,
 "closing_id" integer,
 "gateway_id" varchar(128),
 "nfse_number" varchar(32),
 "verification_code" varchar(64),
 "danfse_url" varchar(512),
 "xml_url" varchar(512),
 "status" "nfse_status" DEFAULT 'draft' NOT NULL,
 "service_name" varchar(255) NOT NULL,
 "service_code" varchar(16) NOT NULL,
 "issqn_rate_percent" numeric(5, 2) NOT NULL,
 "gross_value_cents" integer NOT NULL,
 "issqn_cents" integer NOT NULL,
 "net_value_cents" integer NOT NULL,
 "tomador_name" varchar(255) NOT NULL,
 "tomador_cpf_cnpj" varchar(18),
 "tomador_email" varchar(320),
 "issued_at" timestamp with time zone,
 "cancelled_at" timestamp with time zone,
 "cancel_reason" text,
 "error_message" text,
 "gateway_payload" text,
 "gateway_response" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "fiscal_settings" (
 "id" serial PRIMARY KEY NOT NULL,
 "tenant_id" integer NOT NULL,
 "municipal_registration" varchar(32),
 "tax_regime" varchar(32),
 "default_service_code" varchar(16),
 "default_service_name" varchar(255),
 "issqn_rate_percent" numeric(5, 2),
 "asaas_api_key" varchar(128),
 "asaas_sandbox" integer DEFAULT 1 NOT NULL,
 "focus_api_token" varchar(128),
 "focus_sandbox" integer DEFAULT 1 NOT NULL,
 "city_code" varchar(16),
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "fiscal_settings_tenant_id_unique" UNIQUE("tenant_id")
);

DO $$ BEGIN
 ALTER TABLE "boletos"
 ADD CONSTRAINT "boletos_tenant_id_tenants_id_fk"
 FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "boletos"
 ADD CONSTRAINT "boletos_ar_id_accounts_receivable_id_fk"
 FOREIGN KEY ("ar_id") REFERENCES "public"."accounts_receivable"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "boletos"
 ADD CONSTRAINT "boletos_client_id_clients_id_fk"
 FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "nfse"
 ADD CONSTRAINT "nfse_tenant_id_tenants_id_fk"
 FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "nfse"
 ADD CONSTRAINT "nfse_client_id_clients_id_fk"
 FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "nfse"
 ADD CONSTRAINT "nfse_ar_id_accounts_receivable_id_fk"
 FOREIGN KEY ("ar_id") REFERENCES "public"."accounts_receivable"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "fiscal_settings"
 ADD CONSTRAINT "fiscal_settings_tenant_id_tenants_id_fk"
 FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
 ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "boletos_tenant_idx" ON "boletos" ("tenant_id");
CREATE INDEX IF NOT EXISTS "boletos_ar_idx" ON "boletos" ("ar_id");
CREATE INDEX IF NOT EXISTS "boletos_client_idx" ON "boletos" ("client_id");
CREATE INDEX IF NOT EXISTS "boletos_gateway_idx" ON "boletos" ("gateway_id");
CREATE INDEX IF NOT EXISTS "boletos_status_idx" ON "boletos" ("status");

CREATE INDEX IF NOT EXISTS "nfse_tenant_idx" ON "nfse" ("tenant_id");
CREATE INDEX IF NOT EXISTS "nfse_client_idx" ON "nfse" ("client_id");
CREATE INDEX IF NOT EXISTS "nfse_status_idx" ON "nfse" ("status");
CREATE INDEX IF NOT EXISTS "nfse_gateway_idx" ON "nfse" ("gateway_id");
CREATE INDEX IF NOT EXISTS "nfse_number_idx" ON "nfse" ("tenant_id", "nfse_number");

CREATE INDEX IF NOT EXISTS "fiscal_settings_tenant_idx" ON "fiscal_settings" ("tenant_id");
