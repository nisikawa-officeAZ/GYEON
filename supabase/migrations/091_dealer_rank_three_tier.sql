-- =============================================================================
-- PHASE91: Three Official GYEON Dealer Ranks
-- File: 091_dealer_rank_three_tier.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor. Apply AFTER migration 090.
--
-- Establishes the three official, strictly-ordinal ranks:
--   shop (1) < detailer (2) < certified_detailer (3)
--
-- This migration performs a CONTROLLED, approved data normalization + backfill
-- (locked decisions):
--   - dealer_settings.detailer_rank : 'certified' -> 'certified_detailer'
--   - dealers.detailer_rank         : 'certified' -> 'certified_detailer';
--                                     NULL/'' -> 'detailer' (backfill);
--                                     then rank becomes MANDATORY (NOT NULL).
--   - Both CHECK constraints widened to ('shop','detailer','certified_detailer').
--
-- Idempotent and non-destructive beyond the explicit value mapping above.
-- Existing 'detailer' rows are unchanged.
-- =============================================================================

-- ─── 1. dealer_settings.detailer_rank (NOT NULL, default 'detailer' from 070) ─
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'dealer_settings_detailer_rank_check'
               AND conrelid = 'public.dealer_settings'::regclass) THEN
    ALTER TABLE public.dealer_settings DROP CONSTRAINT dealer_settings_detailer_rank_check;
  END IF;
END;
$$;

UPDATE public.dealer_settings
   SET detailer_rank = 'certified_detailer'
 WHERE detailer_rank = 'certified';

ALTER TABLE public.dealer_settings
  ADD CONSTRAINT dealer_settings_detailer_rank_check
  CHECK (detailer_rank IN ('shop','detailer','certified_detailer'));

-- ─── 2. dealers.detailer_rank (was nullable/unconstrained — becomes mandatory) ─
UPDATE public.dealers
   SET detailer_rank = 'certified_detailer'
 WHERE detailer_rank = 'certified';

UPDATE public.dealers
   SET detailer_rank = 'detailer'
 WHERE detailer_rank IS NULL OR btrim(detailer_rank) = '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'dealers_detailer_rank_check'
                   AND conrelid = 'public.dealers'::regclass) THEN
    ALTER TABLE public.dealers
      ADD CONSTRAINT dealers_detailer_rank_check
      CHECK (detailer_rank IN ('shop','detailer','certified_detailer'));
  END IF;
END;
$$;

ALTER TABLE public.dealers ALTER COLUMN detailer_rank SET DEFAULT 'detailer';
ALTER TABLE public.dealers ALTER COLUMN detailer_rank SET NOT NULL;

-- ─── 3. Refresh PostgREST schema cache ────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- Verification:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'dealers_detailer_rank_check';
--   -- expect: CHECK (detailer_rank = ANY (ARRAY['shop','detailer','certified_detailer']))
--
--   SELECT detailer_rank, count(*) FROM public.dealers GROUP BY 1;
--   -- expect: no NULLs; only shop/detailer/certified_detailer
-- =============================================================================
