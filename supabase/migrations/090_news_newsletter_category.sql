-- =============================================================================
-- PHASE90: News Center — add 'newsletter' category
-- File: 090_news_newsletter_category.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor. Apply AFTER migration 089.
--
-- Purpose:
--   Add a new allowed value 'newsletter' to gyeon_news.category. The category is
--   DB-constrained by a CHECK (migration 082); this migration widens that CHECK.
--
-- Safety:
--   - Idempotent: drops the existing constraint (if present) and re-adds the
--     expanded one.
--   - Non-destructive: all existing category values remain valid; no rows change.
--   - Only the category CHECK is touched. No RLS / auth / other columns changed.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'gyeon_news_category_check'
      AND conrelid = 'public.gyeon_news'::regclass
  ) THEN
    ALTER TABLE public.gyeon_news DROP CONSTRAINT gyeon_news_category_check;
    RAISE NOTICE 'Dropped old gyeon_news_category_check';
  END IF;
END;
$$;

ALTER TABLE public.gyeon_news
  ADD CONSTRAINT gyeon_news_category_check CHECK (category IN (
    'announcement','new_product','stock_arrival','backorder',
    'event','training','technical','system','newsletter'));
