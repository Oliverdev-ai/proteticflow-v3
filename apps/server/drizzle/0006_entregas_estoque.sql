-- Migration 0006: Entregas + Estoque (Fases 9+10)

-- ═══ ENTREGAS ═══════════════════════════════════════════════════════════════

CREATE TYPE "public"."delivery_status" AS ENUM('scheduled', 'in_transit', 'delivered', 'failed');

CREATE TABLE IF NOT EXISTS "delivery_schedules" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "date" timestamp with time zone NOT NULL,
  "driver_name" varchar(255),
  "vehicle" varchar(128),
  "notes" text,
  "created_by" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ds_tenant_idx" ON "delivery_schedules" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ds_date_idx" ON "delivery_schedules" ("tenant_id", "date");

CREATE TABLE IF NOT EXISTS "delivery_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "schedule_id" integer NOT NULL,
  "job_id" integer NOT NULL,
  "client_id" integer NOT NULL,
  "status" "delivery_status" DEFAULT 'scheduled' NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "delivered_at" timestamp with time zone,
  "failed_reason" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "di_tenant_idx" ON "delivery_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "di_schedule_idx" ON "delivery_items" ("schedule_id");
CREATE INDEX IF NOT EXISTS "di_job_idx" ON "delivery_items" ("job_id");
CREATE INDEX IF NOT EXISTS "di_client_idx" ON "delivery_items" ("client_id");

-- ═══ ORDENS DE COMPRA ═══════════════════════════════════════════════════════

CREATE TYPE "public"."purchase_order_status" AS ENUM('draft', 'sent', 'received', 'cancelled');

CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "supplier_id" integer,
  "code" varchar(32) NOT NULL,
  "status" "purchase_order_status" DEFAULT 'draft' NOT NULL,
  "total_cents" integer NOT NULL DEFAULT 0,
  "notes" text,
  "received_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_by" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by" integer
);
CREATE INDEX IF NOT EXISTS "po_tenant_idx" ON "purchase_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "po_supplier_idx" ON "purchase_orders" ("supplier_id");
CREATE INDEX IF NOT EXISTS "po_status_idx" ON "purchase_orders" ("status");

CREATE TABLE IF NOT EXISTS "purchase_order_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "purchase_order_id" integer NOT NULL,
  "material_id" integer NOT NULL,
  "quantity" numeric(10, 3) NOT NULL,
  "unit_price_cents" integer NOT NULL,
  "total_cents" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "poi_tenant_idx" ON "purchase_order_items" ("tenant_id");
CREATE INDEX IF NOT EXISTS "poi_po_idx" ON "purchase_order_items" ("purchase_order_id");
CREATE INDEX IF NOT EXISTS "poi_material_idx" ON "purchase_order_items" ("material_id");

-- ═══ AJUSTES EM TABELAS EXISTENTES ══════════════════════════════════════════

-- materials: campos faltantes (PRD 09.01)
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "code" varchar(64);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "barcode" varchar(128);
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "last_purchase_price_cents" integer;
ALTER TABLE "materials" ADD COLUMN IF NOT EXISTS "average_cost_cents" integer NOT NULL DEFAULT 0;

-- suppliers: CNPJ (PRD 09.03)
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "cnpj" varchar(18);

-- stockMovements: FKs opcionais
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "supplier_id" integer;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "purchase_order_id" integer;

-- Index para busca de materiais
CREATE INDEX IF NOT EXISTS "mat_code_idx" ON "materials" ("code");
CREATE INDEX IF NOT EXISTS "mat_barcode_idx" ON "materials" ("barcode");
