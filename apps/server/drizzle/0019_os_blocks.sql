CREATE TABLE IF NOT EXISTS "os_blocks" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "client_id" integer NOT NULL REFERENCES "clients"("id"),
  "start_number" integer NOT NULL,
  "end_number" integer NOT NULL,
  "label" varchar(64),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "os_blocks_tenant_range"
  ON "os_blocks" ("tenant_id", "start_number", "end_number");
