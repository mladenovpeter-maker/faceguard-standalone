-- Migration: Turnstile zone support
-- Run manually on server: docker compose exec postgres psql -U postgres -d faceguard -f /migrations/0003_turnstile_zones.sql
-- Or via psql directly.

ALTER TABLE "zones" ADD COLUMN IF NOT EXISTS "zone_type" text DEFAULT 'general' NOT NULL;

ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "clock_in_at" timestamp with time zone;
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "clock_out_at" timestamp with time zone;
