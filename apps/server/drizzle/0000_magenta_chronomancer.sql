CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('trial', 'starter', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."tenant_member_role" AS ENUM('superadmin', 'gerente', 'producao', 'recepcao', 'contabil');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('waiting', 'in_production', 'review', 'ready', 'delivered', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."ap_status" AS ENUM('pending', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."ar_status" AS ENUM('pending', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."closing_status" AS ENUM('open', 'closed', 'paid');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('in', 'out', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."notif_type" AS ENUM('info', 'warning', 'danger', 'success');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "tenant_member_role" DEFAULT 'recepcao' NOT NULL,
	"token" varchar(128) NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"invited_by" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "tenant_member_role" DEFAULT 'recepcao' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"plan" "plan_tier" DEFAULT 'trial' NOT NULL,
	"plan_expires_at" timestamp with time zone,
	"logo_url" text,
	"cnpj" varchar(18),
	"phone" varchar(32),
	"email" varchar(320),
	"address" text,
	"city" varchar(128),
	"state" varchar(2),
	"is_active" boolean DEFAULT true NOT NULL,
	"parent_tenant_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"created_by" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"permissions" jsonb,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deadline_notif_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"notified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" varchar(128) NOT NULL,
	"user_agent" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"email" varchar(320),
	"phone" varchar(32),
	"password_hash" varchar(255),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"active_tenant_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_signed_in" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "client_portal_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"token" varchar(64) NOT NULL,
	"label" varchar(128) DEFAULT 'Acesso padrao',
	"expires_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_access_at" timestamp with time zone,
	"access_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "client_portal_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"clinic" varchar(255),
	"email" varchar(320),
	"phone" varchar(32),
	"city" varchar(128),
	"state" varchar(2),
	"status" "client_status" DEFAULT 'active' NOT NULL,
	"total_jobs" integer DEFAULT 0 NOT NULL,
	"total_revenue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"block_start" integer NOT NULL,
	"block_end" integer NOT NULL,
	"description" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(128) NOT NULL,
	"material" varchar(255),
	"estimated_days" integer DEFAULT 5 NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"user_id" integer,
	"user_name" varchar(255),
	"from_status" varchar(64),
	"to_status" varchar(64) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"code" varchar(32) NOT NULL,
	"order_number" integer,
	"client_id" integer NOT NULL,
	"price_item_id" integer,
	"service_name" varchar(255) NOT NULL,
	"patient_name" varchar(255),
	"tooth" varchar(32),
	"status" "job_status" DEFAULT 'waiting' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"notes" text,
	"assigned_to" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts_payable" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"description" varchar(512) NOT NULL,
	"supplier" varchar(255),
	"category" varchar(128),
	"amount" numeric(10, 2) NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"status" "ap_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts_receivable" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"job_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" varchar(512),
	"due_date" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"status" "ar_status" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_closings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"period" varchar(7) NOT NULL,
	"total_jobs" integer DEFAULT 0 NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pending_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "closing_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "material_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"color" varchar(32) DEFAULT 'slate',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"category_id" integer,
	"supplier_id" integer,
	"name" varchar(255) NOT NULL,
	"unit" varchar(32) DEFAULT 'un' NOT NULL,
	"current_stock" numeric(10, 3) DEFAULT '0' NOT NULL,
	"min_stock" numeric(10, 3) DEFAULT '0' NOT NULL,
	"max_stock" numeric(10, 3),
	"cost_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"material_id" integer NOT NULL,
	"type" "movement_type" NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"stock_after" numeric(10, 3) NOT NULL,
	"reason" varchar(512),
	"job_id" integer,
	"invoice_number" varchar(128),
	"unit_cost" numeric(10, 2),
	"notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact" varchar(255),
	"email" varchar(320),
	"phone" varchar(32),
	"address" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"type" "notif_type" DEFAULT 'info' NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"related_job_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lab_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"lab_name" varchar(256) DEFAULT 'Laboratorio de Protese' NOT NULL,
	"cnpj" varchar(18),
	"phone" varchar(32),
	"email" varchar(320),
	"address" text,
	"city" varchar(128),
	"state" varchar(2),
	"zip_code" varchar(10),
	"logo_url" text,
	"report_header" text,
	"report_footer" text,
	"primary_color" varchar(7) DEFAULT '#1a56db',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "client_portal_tokens" ADD CONSTRAINT "client_portal_tokens_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tm_tenant_user_idx" ON "tenant_members" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tm_user_idx" ON "tenant_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tm_tenant_idx" ON "tenant_members" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenants_slug_idx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenants_active_idx" ON "tenants" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_tenant_idx" ON "api_keys" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_prefix_idx" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ps_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cpt_token_idx" ON "client_portal_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cpt_tenant_idx" ON "client_portal_tokens" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cpt_client_idx" ON "client_portal_tokens" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cpt_active_idx" ON "client_portal_tokens" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_tenant_idx" ON "clients" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_blocks_tenant_idx" ON "order_blocks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_blocks_client_idx" ON "order_blocks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_blocks_start_idx" ON "order_blocks" USING btree ("block_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "price_items_tenant_idx" ON "price_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_logs_tenant_idx" ON "job_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_logs_job_idx" ON "job_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_logs_created_at_idx" ON "job_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_tenant_idx" ON "jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_tenant_code_idx" ON "jobs" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_order_number_idx" ON "jobs" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_client_idx" ON "jobs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_assigned_to_idx" ON "jobs" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ap_tenant_idx" ON "accounts_payable" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ap_status_idx" ON "accounts_payable" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ap_due_date_idx" ON "accounts_payable" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ar_tenant_idx" ON "accounts_receivable" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ar_client_idx" ON "accounts_receivable" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ar_status_idx" ON "accounts_receivable" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "closing_tenant_idx" ON "financial_closings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "closing_client_period_idx" ON "financial_closings" USING btree ("client_id","period");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mat_cat_tenant_idx" ON "material_categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mat_tenant_idx" ON "materials" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mat_category_idx" ON "materials" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mat_supplier_idx" ON "materials" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mat_active_idx" ON "materials" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sm_tenant_idx" ON "stock_movements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sm_material_idx" ON "stock_movements" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sm_type_idx" ON "stock_movements" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sm_created_at_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sm_job_idx" ON "stock_movements" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_tenant_idx" ON "suppliers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_tenant_user_idx" ON "chat_messages" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notif_tenant_user_idx" ON "notifications" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lab_settings_tenant_idx" ON "lab_settings" USING btree ("tenant_id");