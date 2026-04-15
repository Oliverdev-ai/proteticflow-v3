ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS full_access_until timestamp with time zone;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS manager_actions_this_month integer NOT NULL DEFAULT 0;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS manager_actions_month_ref timestamp with time zone NOT NULL DEFAULT now();

UPDATE tenants
SET full_access_until = CASE
  WHEN plan = 'trial' THEN LEAST(
    COALESCE(plan_expires_at, created_at + interval '14 day'),
    created_at + interval '14 day'
  )
  WHEN plan IN ('starter', 'pro') THEN created_at + interval '30 day'
  ELSE NULL
END
WHERE full_access_until IS NULL;

DO $$
BEGIN
  CREATE TYPE support_suggestion_status AS ENUM ('received', 'reviewing', 'implemented', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE support_suggestion_impact AS ENUM ('low', 'medium', 'high');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS support_suggestions (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  author_user_id integer NOT NULL REFERENCES users(id),
  title varchar(140) NOT NULL,
  description text NOT NULL,
  category varchar(64) NOT NULL,
  perceived_impact support_suggestion_impact NOT NULL,
  status support_suggestion_status NOT NULL DEFAULT 'received',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_suggestions_tenant_idx ON support_suggestions (tenant_id);
CREATE INDEX IF NOT EXISTS support_suggestions_status_idx ON support_suggestions (tenant_id, status);
