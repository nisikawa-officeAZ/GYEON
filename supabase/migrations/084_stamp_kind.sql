-- PHASE84: Standardized stamp sizing — stamp shape kind.
-- DO NOT AUTO-APPLY — paste into Supabase SQL Editor manually.
--
-- Records whether the dealer's saved 印影 (stamp) is a square company seal
-- (会社印, 20mm × 20mm) or a round personal seal (個人印, 18mm diameter), so
-- PDF rendering can place it at the correct standardized physical size.
-- The stamp image itself is already normalized to that size on upload/generate
-- and stored as a transparent PNG at dealer_settings.stamp_path (migration 081).

ALTER TABLE public.dealer_settings
  ADD COLUMN IF NOT EXISTS stamp_kind text;

ALTER TABLE public.dealer_settings
  DROP CONSTRAINT IF EXISTS dealer_settings_stamp_kind_check;
ALTER TABLE public.dealer_settings
  ADD CONSTRAINT dealer_settings_stamp_kind_check
    CHECK (stamp_kind IS NULL OR stamp_kind IN ('square', 'round'));
