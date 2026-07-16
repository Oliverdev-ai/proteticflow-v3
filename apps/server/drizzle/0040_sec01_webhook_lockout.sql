CREATE TABLE IF NOT EXISTS "asaas_webhook_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" varchar(128) NOT NULL,
  "event_type" varchar(64),
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "asaas_webhook_events_event_id_unique"
  ON "asaas_webhook_events" ("event_id");

CREATE INDEX IF NOT EXISTS "asaas_webhook_events_received_at_idx"
  ON "asaas_webhook_events" ("received_at");

CREATE TABLE IF NOT EXISTS "login_attempts" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" varchar(320) NOT NULL,
  "ip" varchar(64) NOT NULL,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "last_failed_at" timestamp with time zone,
  "locked_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "login_attempts_email_ip_unique"
  ON "login_attempts" ("email", "ip");

CREATE INDEX IF NOT EXISTS "login_attempts_locked_until_idx"
  ON "login_attempts" ("locked_until");
