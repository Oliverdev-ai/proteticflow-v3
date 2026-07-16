-- SEC-02 M-01: encrypted TOTP secrets exceed the legacy varchar(128) limit.
-- Existing rows are encrypted by scripts/backfill-2fa-secrets.ts, not by SQL.
ALTER TABLE users
  ALTER COLUMN two_factor_secret TYPE text;
