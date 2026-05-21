-- Migration 0035: Preferência de tema por usuário
-- Sprint UX-0 Foundation — ThemeProvider com persistência DB
-- tenant-isolation-ok: users.id é global, theme é preferência pessoal

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "theme_preference" varchar(8)
    NOT NULL DEFAULT 'system'
    CHECK ("theme_preference" IN ('system', 'light', 'dark'));
