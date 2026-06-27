-- =============================================================================
-- PHASE74: Dealer Trial Period & Approval Defaults
-- File: 074_dealer_trial_fields.sql
-- =============================================================================
-- MANUAL APPLY ONLY. Paste into Supabase SQL Editor.
-- Apply AFTER migration 071 (dealer_approval_flow).
-- All ADD COLUMN IF NOT EXISTS — safe to re-run.
-- No DROP statements. No destructive changes.
-- =============================================================================

-- Section 1: Add trial and plan fields to dealers
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS trial_plan_type           text   DEFAULT 'pro_plus',
  ADD COLUMN IF NOT EXISTS service_start_date        date,
  ADD COLUMN IF NOT EXISTS trial_start_date          date,
  ADD COLUMN IF NOT EXISTS trial_end_date            date,
  ADD COLUMN IF NOT EXISTS trial_status              text   NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS auto_downgrade_plan_type  text   DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS detailer_rank             text;

-- Section 2: CHECK constraint for trial_status (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'dealers'
      AND c.conname = 'dealers_trial_status_check'
  ) THEN
    ALTER TABLE public.dealers
      ADD CONSTRAINT dealers_trial_status_check
      CHECK (trial_status IN ('none', 'active', 'ended'));
  END IF;
END;
$$;

-- Section 3: Index for auto-downgrade cron performance
CREATE INDEX IF NOT EXISTS dealers_trial_active_end_idx
  ON public.dealers (trial_end_date)
  WHERE trial_status = 'active';

-- Section 4: RLS policy note
-- trial_status, trial_end_date, auto_downgrade_plan_type must only be
-- written by admin server actions using service_role key.
-- Dealer members may read their own dealer row via the existing
-- dealers SELECT policy.

-- Verification queries (run after applying):
-- SELECT id, trial_status, trial_end_date, auto_downgrade_plan_type
--   FROM public.dealers LIMIT 10;
-- SELECT trial_status, COUNT(*) FROM public.dealers GROUP BY trial_status;
