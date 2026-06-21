-- Migration: 035_update_customers_schema.sql
-- Purpose : Extend customers table to new schema.
--           Existing data is preserved.
--           Legacy columns are NOT dropped (backward-compat, future phase cleanup).
--
-- MANUAL APPLICATION ONLY — never apply automatically.
-- Run in Supabase SQL Editor for development environment only.

-- ─────────────────────────────────────────────────────────────────
-- 1. Add new columns (IF NOT EXISTS = idempotent)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_code     text,
  ADD COLUMN IF NOT EXISTS last_name         text,
  ADD COLUMN IF NOT EXISTS first_name        text,
  ADD COLUMN IF NOT EXISTS last_name_kana    text,
  ADD COLUMN IF NOT EXISTS first_name_kana   text,
  ADD COLUMN IF NOT EXISTS prefecture        text,
  ADD COLUMN IF NOT EXISTS city              text,
  ADD COLUMN IF NOT EXISTS address1          text,
  ADD COLUMN IF NOT EXISTS address2          text,
  ADD COLUMN IF NOT EXISTS birthday          date,
  ADD COLUMN IF NOT EXISTS gender            text,
  ADD COLUMN IF NOT EXISTS occupation        text,
  ADD COLUMN IF NOT EXISTS notes             text,
  ADD COLUMN IF NOT EXISTS line_user_id      text,
  ADD COLUMN IF NOT EXISTS line_display_name text,
  ADD COLUMN IF NOT EXISTS line_picture_url  text,
  ADD COLUMN IF NOT EXISTS line_connected    boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────────
-- 2. Migrate existing data from legacy columns to new columns
--    Only fill when new column is still NULL (idempotent).
-- ─────────────────────────────────────────────────────────────────

-- name → last_name  (existing full name stored as last_name)
UPDATE public.customers
  SET last_name = name
  WHERE last_name IS NULL AND name IS NOT NULL AND name <> '';

-- kana → last_name_kana
UPDATE public.customers
  SET last_name_kana = kana
  WHERE last_name_kana IS NULL AND kana IS NOT NULL AND kana <> '';

-- address → address1
UPDATE public.customers
  SET address1 = address
  WHERE address1 IS NULL AND address IS NOT NULL AND address <> '';

-- memo → notes
UPDATE public.customers
  SET notes = memo
  WHERE notes IS NULL AND memo IS NOT NULL AND memo <> '';

-- line_id → line_user_id
UPDATE public.customers
  SET line_user_id = line_id
  WHERE line_user_id IS NULL AND line_id IS NOT NULL AND line_id <> '';

-- ─────────────────────────────────────────────────────────────────
-- 3. Legacy columns retained (NOT dropped)
--    name, kana, address, memo, line_id remain for compatibility.
--    DROP will occur in a future "legacy cleanup" phase.
-- ─────────────────────────────────────────────────────────────────

-- Verification query (run after applying):
-- SELECT id, name, last_name, first_name, kana, last_name_kana, address, address1, memo, notes, line_id, line_user_id
-- FROM public.customers LIMIT 10;
