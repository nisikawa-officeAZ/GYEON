-- =============================================================================
-- Add GYEON PPF Installer dealer rank
-- File: 097_add_ppf_installer_rank.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor. Apply AFTER migration 096.
--
-- Purpose:
--   Introduce a new selectable dealer rank 'ppf_installer' (GYEON PPF Installer),
--   ordered between 'detailer' and 'certified'. This is a forward-compatible
--   addition for a future official GYEON PPF-only dealer category.
--
-- Canonical ranks (strictly ordinal):
--   shop (1) < detailer (2) < ppf_installer (3) < certified (4)
--
-- Changes:
--   - Widen dealer_settings.detailer_rank CHECK to allow 'ppf_installer'.
--   - Widen dealers.detailer_rank        CHECK to allow 'ppf_installer'.
--
-- Existing data:
--   UNCHANGED. No rows are migrated. 'ppf_installer' is simply added as a new
--   allowed value. Existing 'shop' / 'detailer' / 'certified' rows keep their
--   value. Permissions remain product-level (rank is only an eligibility class).
--
-- Idempotent: drops each constraint if present, then re-adds the widened one.
-- =============================================================================

-- ── dealer_settings.detailer_rank ─────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dealer_settings_detailer_rank_check') THEN
    ALTER TABLE public.dealer_settings DROP CONSTRAINT dealer_settings_detailer_rank_check;
  END IF;
END $$;

ALTER TABLE public.dealer_settings
  ADD CONSTRAINT dealer_settings_detailer_rank_check
  CHECK (detailer_rank IN ('shop', 'detailer', 'ppf_installer', 'certified'));

-- ── dealers.detailer_rank ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dealers_detailer_rank_check') THEN
    ALTER TABLE public.dealers DROP CONSTRAINT dealers_detailer_rank_check;
  END IF;
END $$;

ALTER TABLE public.dealers
  ADD CONSTRAINT dealers_detailer_rank_check
  CHECK (detailer_rank IN ('shop', 'detailer', 'ppf_installer', 'certified'));

-- ── Verification (expect both constraints listing 4 values incl. ppf_installer) ─
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN ('dealer_settings_detailer_rank_check', 'dealers_detailer_rank_check')
ORDER BY conname;
