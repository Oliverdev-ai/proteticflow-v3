DO $$ BEGIN
 CREATE TYPE "public"."chatbot_conversation_status" AS ENUM('open', 'escalated', 'resolved', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."chatbot_conversation_type" AS ENUM('status_query', 'scheduling', 'quote', 'technical_support', 'general', 'complaint');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."chatbot_message_role" AS ENUM('user', 'assistant', 'system');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "chatbot_conversations" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "client_id" integer REFERENCES "clients"("id"),
  "portal_token_id" integer REFERENCES "portal_tokens"("id"),
  "type" "chatbot_conversation_type" DEFAULT 'general' NOT NULL,
  "status" "chatbot_conversation_status" DEFAULT 'open' NOT NULL,
  "satisfaction_score" integer,
  "escalated_to_user_id" integer REFERENCES "users"("id"),
  "escalated_at" timestamp with time zone,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "chatbot_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "conversation_id" integer NOT NULL REFERENCES "chatbot_conversations"("id") ON DELETE CASCADE,
  "role" "chatbot_message_role" NOT NULL,
  "content" text NOT NULL,
  "intent_detected" varchar(64),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "auto_response_templates" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "intent" varchar(64) NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" text NOT NULL,
  "is_active" integer DEFAULT 1 NOT NULL,
  "created_by" integer REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id"),
  "client_id" integer REFERENCES "clients"("id"),
  "conversation_id" integer REFERENCES "chatbot_conversations"("id"),
  "assigned_to_user_id" integer REFERENCES "users"("id"),
  "priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
  "status" "ticket_status" DEFAULT 'open' NOT NULL,
  "subject" varchar(255) NOT NULL,
  "description" text NOT NULL,
  "resolved_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ticket_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL,
  "ticket_id" integer NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "author_id" integer REFERENCES "users"("id"),
  "content" text NOT NULL,
  "is_internal" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "chatbot_conv_tenant_idx" ON "chatbot_conversations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "chatbot_conv_client_idx" ON "chatbot_conversations" ("client_id");
CREATE INDEX IF NOT EXISTS "chatbot_conv_status_idx" ON "chatbot_conversations" ("status");

CREATE INDEX IF NOT EXISTS "chatbot_msg_conversation_idx" ON "chatbot_messages" ("conversation_id");
CREATE INDEX IF NOT EXISTS "chatbot_msg_tenant_idx" ON "chatbot_messages" ("tenant_id");

CREATE INDEX IF NOT EXISTS "templates_tenant_intent_idx" ON "auto_response_templates" ("tenant_id", "intent");

CREATE INDEX IF NOT EXISTS "tickets_tenant_idx" ON "support_tickets" ("tenant_id");
CREATE INDEX IF NOT EXISTS "tickets_status_idx" ON "support_tickets" ("status");
CREATE INDEX IF NOT EXISTS "tickets_priority_idx" ON "support_tickets" ("priority");
CREATE INDEX IF NOT EXISTS "tickets_assigned_idx" ON "support_tickets" ("assigned_to_user_id");

CREATE INDEX IF NOT EXISTS "ticket_msg_ticket_idx" ON "ticket_messages" ("ticket_id");
CREATE INDEX IF NOT EXISTS "ticket_msg_tenant_idx" ON "ticket_messages" ("tenant_id");
