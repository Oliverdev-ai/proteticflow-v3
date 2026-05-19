-- Migration 0029: adiciona novos eventos ao enum notif_event
-- S5-07: Notificações In-App (trial_expiring, payment_overdue, plan_upgraded)
-- FIX: enum criado via db:push, não via migration — criar idempotentemente antes de ALTER

DO $$ BEGIN
  CREATE TYPE "notif_event" AS ENUM (
    'invite',
    'password_reset',
    'report_ready',
    'deadline_24h',
    'ar_overdue'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TYPE "notif_event" ADD VALUE IF NOT EXISTS 'trial_expiring';
--> statement-breakpoint
ALTER TYPE "notif_event" ADD VALUE IF NOT EXISTS 'payment_overdue';
--> statement-breakpoint
ALTER TYPE "notif_event" ADD VALUE IF NOT EXISTS 'plan_upgraded';
