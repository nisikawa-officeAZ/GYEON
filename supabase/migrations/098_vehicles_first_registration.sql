-- =============================================================================
-- Vehicles: add 初度登録年月 (first registration year-month) column
-- File: 098_vehicles_first_registration.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor. Apply AFTER migration 097.
--
-- Reason:
--   Japanese registration certificates carry TWO distinct dates:
--     - 初度登録年月 (first registration, YYYY-MM) — used for 年式 / vehicle age
--     - 登録年月日   (current registration, YYYY-MM-DD) — vehicles.registration_date (already exists)
--   The vehicles table already has `registration_date` and `year`, but has NO
--   column for the first-registration year-month. This adds it.
--
-- Existing data: UNCHANGED. New nullable text column, additive only. Idempotent.
--
-- After applying, the vehicle create/update actions and the estimate detail/PDF
-- can persist and display 初度登録年月. Until then it is captured only in the OCR
-- metadata (vehicle_registration_files.ocr_result.first_registration_date).
-- =============================================================================

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS first_registration_year_month text;

COMMENT ON COLUMN public.vehicles.first_registration_year_month IS
  '初度登録年月 (first registration, YYYY-MM). Distinct from registration_date (登録年月日 / current).';
