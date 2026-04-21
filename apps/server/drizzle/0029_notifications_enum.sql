-- Migration 0029: adiciona novos eventos ao enum notif_event
-- S5-07: Notificações In-App (trial_expiring, payment_overdue, plan_upgraded)
-- Nota: ALTER TYPE ADD VALUE é permitido em transações no PostgreSQL 12+

ALTER TYPE "notif_event" ADD VALUE IF NOT EXISTS 'trial_expiring';
--> statement-breakpoint
ALTER TYPE "notif_event" ADD VALUE IF NOT EXISTS 'payment_overdue';
--> statement-breakpoint
ALTER TYPE "notif_event" ADD VALUE IF NOT EXISTS 'plan_upgraded';
