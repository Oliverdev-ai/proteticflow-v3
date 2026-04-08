CREATE TABLE IF NOT EXISTS "portal_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_access_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_tokens_token_hash_unique" UNIQUE("token_hash")
);

DO $$ BEGIN
 ALTER TABLE "portal_tokens"
 ADD CONSTRAINT "portal_tokens_client_id_clients_id_fk"
 FOREIGN KEY ("client_id")
 REFERENCES "public"."clients"("id")
 ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "portal_tokens_tenant_idx" ON "portal_tokens" ("tenant_id");
CREATE INDEX IF NOT EXISTS "portal_tokens_client_idx" ON "portal_tokens" ("client_id");
CREATE INDEX IF NOT EXISTS "portal_tokens_expires_idx" ON "portal_tokens" ("expires_at");
