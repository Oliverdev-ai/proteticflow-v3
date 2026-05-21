-- UX-3 Frente C: preferencia persistida de sidebar por usuario

ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "sidebar_collapsed" boolean NOT NULL DEFAULT false;
