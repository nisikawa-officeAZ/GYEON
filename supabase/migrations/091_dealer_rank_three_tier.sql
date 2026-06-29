-- =============================================================================
-- PHASE91: Three Official GYEON Dealer Ranks
-- File: 091_dealer_rank_three_tier.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor. Apply AFTER migration 090.
--
-- Canonical ranks (strictly ordinal):  shop (1) < detailer (2) < certified (3)
--
-- Controlled, approved data normalization + backfill (locked decisions):
--   - dealers.detailer_rank        : 'certified_detailer' -> 'certified';
--                                    NULL/'' -> 'detailer' (backfill);
--                                    then rank becomes MANDATORY (NOT NULL).
--   - dealer_settings.detailer_rank: already uses 'certified'/'detailer' — only
--                                    the CHECK is widened to allow 'shop'.
--   - Both CHECK constraints widened to ('shop','detailer','certified').
--
-- Idempotent and non-destructive beyond the explicit value mapping above.
-- Existing 'detailer'/'certified' rows are unchanged.
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

ALTER TABLE public.dealer_settings
  ADD CONSTRAINT dealer_settings_detailer_rank_check
  CHECK (detailer_rank IN ('shop','detailer','certified'));

-- ─── 2. dealers.detailer_rank (was nullable/unconstrained — becomes mandatory) ─
UPDATE public.dealers
   SET detailer_rank = 'certified'
 WHERE detailer_rank = 'certified_detailer';

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
      CHECK (detailer_rank IN ('shop','detailer','certified'));
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
--   -- expect: CHECK (detailer_rank = ANY (ARRAY['shop','detailer','certified']))
--
--   SELECT detailer_rank, count(*) FROM public.dealers GROUP BY 1;
--   -- expect: no NULLs; only shop/detailer/certified
-- =============================================================================
