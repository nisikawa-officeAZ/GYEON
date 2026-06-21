-- Migration: 036_update_vehicles_schema.sql
-- Purpose : Extend vehicles table to CRM-grade schema.
--           Existing data is preserved.
--           Legacy columns are NOT dropped (backward-compat, future phase cleanup).
--
-- Existing columns:
--   manufacturer, model, year (text), grade, body_color, license_plate, vin, memo
--
-- New columns added:
--   vehicle_code, maker, color, plate_number, body_size, mileage,
--   inspection_expiry_date, notes
--
-- Data migration:
--   manufacturer → maker
--   body_color   → color
--   license_plate→ plate_number
--   memo         → notes
--
-- year: kept as text. Integer conversion deferred to future legacy cleanup phase.
--       Adding year as integer with a different alias would require renaming in a
--       later migration. For now, year (text) is retained as-is.
--
-- MANUAL APPLICATION ONLY — never apply automatically.
-- Run in Supabase SQL Editor for development environment only.

-- ─────────────────────────────────────────────────────────────────
-- 1. Add new columns (IF NOT EXISTS = idempotent)
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_code            text,
  ADD COLUMN IF NOT EXISTS maker                   text,
  ADD COLUMN IF NOT EXISTS color                   text,
  ADD COLUMN IF NOT EXISTS plate_number            text,
  ADD COLUMN IF NOT EXISTS body_size               text,
  ADD COLUMN IF NOT EXISTS mileage                 integer,
  ADD COLUMN IF NOT EXISTS inspection_expiry_date  date,
  ADD COLUMN IF NOT EXISTS notes                   text;

-- ─────────────────────────────────────────────────────────────────
-- 2. Migrate existing data (idempotent — only fills NULL new columns)
-- ─────────────────────────────────────────────────────────────────

-- manufacturer → maker
UPDATE public.vehicles
  SET maker = manufacturer
  WHERE maker IS NULL AND manufacturer IS NOT NULL AND manufacturer <> '';

-- body_color → color
UPDATE public.vehicles
  SET color = body_color
  WHERE color IS NULL AND body_color IS NOT NULL AND body_color <> '';

-- license_plate → plate_number
UPDATE public.vehicles
  SET plate_number = license_plate
  WHERE plate_number IS NULL AND license_plate IS NOT NULL AND license_plate <> '';

-- memo → notes
UPDATE public.vehicles
  SET notes = memo
  WHERE notes IS NULL AND memo IS NOT NULL AND memo <> '';

-- ─────────────────────────────────────────────────────────────────
-- 3. Index for new lookup columns
-- ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS vehicles_plate_number_idx
  ON public.vehicles (plate_number);

CREATE INDEX IF NOT EXISTS vehicles_maker_idx
  ON public.vehicles (maker);

-- ─────────────────────────────────────────────────────────────────
-- 4. Legacy columns retained (NOT dropped)
--    manufacturer, body_color, license_plate, memo remain for
--    compatibility with existing estimate joins.
--    DROP will occur in a future "legacy cleanup" phase.
-- ─────────────────────────────────────────────────────────────────

-- Verification query (run after applying):
-- SELECT id, manufacturer, maker, body_color, color,
--        license_plate, plate_number, memo, notes, vehicle_code
-- FROM public.vehicles LIMIT 10;
