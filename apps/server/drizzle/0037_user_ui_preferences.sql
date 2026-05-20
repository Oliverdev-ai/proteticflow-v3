-- Migration 0037: preferencias de UI por usuario
-- Sprint UX-3 — kanban density e futura sidebar persistidos no servidor

ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "ui_preferences" jsonb
    NOT NULL DEFAULT '{}'::jsonb;
